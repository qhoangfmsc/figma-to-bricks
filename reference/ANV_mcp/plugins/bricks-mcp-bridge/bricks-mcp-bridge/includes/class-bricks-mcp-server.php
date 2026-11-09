<?php
/**
 * Stateless MCP server over Streamable HTTP (single JSON-RPC POST endpoint).
 *
 * Intentionally does NOT declare tool outputSchema: clients enforcing the MCP
 * spec (e.g. Cursor) reject tools that declare a schema but return plain text.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bricks_MCP_Server {

	const PROTOCOL_VERSIONS = array( '2025-06-18', '2025-03-26', '2024-11-05' );

	public static function register_routes() {
		register_rest_route(
			BRICKS_MCP_BRIDGE_REST_NAMESPACE,
			'/mcp',
			array(
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'handle_request' ),
					'permission_callback' => array( __CLASS__, 'check_auth' ),
				),
				array(
					// Streamable HTTP clients may probe with GET for an SSE stream.
					// This server is stateless, so explicitly say it is unsupported.
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'reject_get' ),
					'permission_callback' => array( __CLASS__, 'check_auth' ),
				),
			)
		);
	}

	public static function check_auth( WP_REST_Request $request ) {
		$expected = get_option( BRICKS_MCP_BRIDGE_TOKEN_OPTION );

		if ( empty( $expected ) ) {
			return new WP_Error( 'mcp_no_token', 'No access token configured. Re-activate the plugin.', array( 'status' => 503 ) );
		}

		$provided = '';
		$auth     = $request->get_header( 'authorization' );

		if ( $auth && stripos( $auth, 'Bearer ' ) === 0 ) {
			$provided = trim( substr( $auth, 7 ) );
		}

		// Fallback header for hosts that strip the Authorization header.
		if ( ! $provided ) {
			$provided = (string) $request->get_header( 'x-bricks-mcp-token' );
		}

		if ( ! $provided || ! hash_equals( $expected, $provided ) ) {
			return new WP_Error( 'mcp_unauthorized', 'Invalid or missing access token.', array( 'status' => 401 ) );
		}

		self::impersonate_configured_user();

		return true;
	}

	/**
	 * Token-authenticated requests act as the configured admin user so that
	 * wp_insert_post / update_post_meta run with proper capabilities.
	 */
	private static function impersonate_configured_user() {
		$user_id = (int) get_option( BRICKS_MCP_BRIDGE_USER_OPTION );

		if ( ! $user_id || ! get_userdata( $user_id ) ) {
			$admins  = get_users( array( 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ) );
			$user_id = $admins ? (int) $admins[0] : 0;
		}

		if ( $user_id ) {
			wp_set_current_user( $user_id );
		}
	}

	public static function reject_get() {
		return new WP_REST_Response( array( 'error' => 'SSE streams are not supported. Use JSON-RPC over POST.' ), 405 );
	}

	public static function handle_request( WP_REST_Request $request ) {
		$message = json_decode( $request->get_body(), true );

		if ( ! is_array( $message ) || empty( $message['jsonrpc'] ) ) {
			return self::error_response( null, -32700, 'Parse error: invalid JSON-RPC payload.' );
		}

		$method = isset( $message['method'] ) ? (string) $message['method'] : '';
		$params = isset( $message['params'] ) && is_array( $message['params'] ) ? $message['params'] : array();
		$has_id = array_key_exists( 'id', $message );
		$id     = $has_id ? $message['id'] : null;

		// Notifications expect no response body.
		if ( ! $has_id ) {
			return new WP_REST_Response( null, 202 );
		}

		switch ( $method ) {
			case 'initialize':
				return self::result_response( $id, self::initialize_result( $params ) );

			case 'ping':
				return self::result_response( $id, new stdClass() );

			case 'tools/list':
				return self::result_response( $id, array( 'tools' => Bricks_MCP_Tools::definitions() ) );

			case 'tools/call':
				return self::handle_tool_call( $id, $params );

			case 'resources/list':
				return self::result_response( $id, array( 'resources' => array() ) );

			case 'prompts/list':
				return self::result_response( $id, array( 'prompts' => array() ) );

			default:
				return self::error_response( $id, -32601, 'Method not found: ' . $method );
		}
	}

	private static function initialize_result( array $params ) {
		$requested = isset( $params['protocolVersion'] ) ? (string) $params['protocolVersion'] : '';
		$version   = in_array( $requested, self::PROTOCOL_VERSIONS, true ) ? $requested : self::PROTOCOL_VERSIONS[0];

		return array(
			'protocolVersion' => $version,
			'capabilities'    => array( 'tools' => new stdClass() ),
			'serverInfo'      => array(
				'name'    => 'bricks-mcp-bridge',
				'version' => BRICKS_MCP_BRIDGE_VERSION,
			),
			'instructions'    => 'Manage Bricks Builder pages and templates. Call get_site_info first to verify the connection. Element data uses the Bricks format: an array of {id, name, parent, children, settings} objects with 6-character alphanumeric ids.',
		);
	}

	private static function handle_tool_call( $id, array $params ) {
		$tool_name = isset( $params['name'] ) ? (string) $params['name'] : '';
		$arguments = isset( $params['arguments'] ) && is_array( $params['arguments'] ) ? $params['arguments'] : array();

		if ( ! Bricks_MCP_Tools::exists( $tool_name ) ) {
			return self::error_response( $id, -32602, 'Unknown tool: ' . $tool_name );
		}

		try {
			$result = Bricks_MCP_Tools::call( $tool_name, $arguments );
		} catch ( Exception $e ) {
			return self::result_response( $id, self::tool_text_result( 'Error: ' . $e->getMessage(), true ) );
		}

		if ( is_wp_error( $result ) ) {
			return self::result_response( $id, self::tool_text_result( 'Error: ' . $result->get_error_message(), true ) );
		}

		$text = is_string( $result ) ? $result : wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		return self::result_response( $id, self::tool_text_result( $text, false ) );
	}

	private static function tool_text_result( $text, $is_error ) {
		return array(
			'content' => array(
				array(
					'type' => 'text',
					'text' => $text,
				),
			),
			'isError' => (bool) $is_error,
		);
	}

	private static function result_response( $id, $result ) {
		return new WP_REST_Response(
			array(
				'jsonrpc' => '2.0',
				'id'      => $id,
				'result'  => $result,
			),
			200
		);
	}

	private static function error_response( $id, $code, $message ) {
		return new WP_REST_Response(
			array(
				'jsonrpc' => '2.0',
				'id'      => $id,
				'error'   => array(
					'code'    => $code,
					'message' => $message,
				),
			),
			200
		);
	}
}
