<?php
/**
 * Settings page: shows the MCP endpoint, access token, and a ready-to-paste
 * Cursor configuration snippet.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bricks_MCP_Admin {

	public static function register_menu() {
		add_options_page(
			'Bricks MCP Bridge',
			'Bricks MCP Bridge',
			'manage_options',
			'bricks-mcp-bridge',
			array( __CLASS__, 'render_page' )
		);
	}

	public static function handle_regenerate_token() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Insufficient permissions.' );
		}

		check_admin_referer( 'bricks_mcp_bridge_regenerate_token' );

		update_option( BRICKS_MCP_BRIDGE_TOKEN_OPTION, wp_generate_password( 64, false, false ), false );
		update_option( BRICKS_MCP_BRIDGE_USER_OPTION, get_current_user_id(), false );

		wp_safe_redirect( admin_url( 'options-general.php?page=bricks-mcp-bridge&regenerated=1' ) );
		exit;
	}

	public static function render_page() {
		$token    = get_option( BRICKS_MCP_BRIDGE_TOKEN_OPTION, '' );
		$endpoint = rest_url( BRICKS_MCP_BRIDGE_REST_NAMESPACE . '/mcp' );

		$cursor_config = wp_json_encode(
			array(
				'mcpServers' => array(
					'bricks-bridge' => array(
						'url'     => $endpoint,
						'headers' => array( 'Authorization' => 'Bearer ' . $token ),
					),
				),
			),
			JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
		);
		?>
		<div class="wrap">
			<h1>Bricks MCP Bridge</h1>

			<?php if ( isset( $_GET['regenerated'] ) ) : ?>
				<div class="notice notice-success"><p>New access token generated. Update your MCP client configuration.</p></div>
			<?php endif; ?>

			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">MCP Endpoint</th>
					<td><code><?php echo esc_html( $endpoint ); ?></code></td>
				</tr>
				<tr>
					<th scope="row">Access Token</th>
					<td>
						<code style="word-break: break-all;"><?php echo esc_html( $token ); ?></code>
						<p class="description">Sent as <code>Authorization: Bearer &lt;token&gt;</code> (or <code>X-Bricks-MCP-Token</code> if your host strips Authorization headers).</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Cursor configuration</th>
					<td>
						<p class="description">Add to <code>~/.cursor/mcp.json</code> (global) or <code>.cursor/mcp.json</code> in your project:</p>
						<textarea readonly rows="10" style="width: 100%; max-width: 640px; font-family: monospace;"><?php echo esc_textarea( $cursor_config ); ?></textarea>
					</td>
				</tr>
			</table>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="bricks_mcp_bridge_regenerate_token" />
				<?php wp_nonce_field( 'bricks_mcp_bridge_regenerate_token' ); ?>
				<?php submit_button( 'Regenerate Token', 'secondary' ); ?>
			</form>
		</div>
		<?php
	}
}
