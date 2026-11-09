<?php
/**
 * Plugin Name: Bricks MCP Bridge
 * Description: Exposes a spec-compliant MCP server (Streamable HTTP) for managing Bricks Builder pages and templates from AI clients like Cursor.
 * Version: 1.3.0
 * Author: Brick_to_Page
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BRICKS_MCP_BRIDGE_VERSION', '1.3.0' );
define( 'BRICKS_MCP_BRIDGE_DIR', plugin_dir_path( __FILE__ ) );
define( 'BRICKS_MCP_BRIDGE_REST_NAMESPACE', 'bricks-mcp-bridge/v1' );
define( 'BRICKS_MCP_BRIDGE_TOKEN_OPTION', 'bricks_mcp_bridge_token' );
define( 'BRICKS_MCP_BRIDGE_USER_OPTION', 'bricks_mcp_bridge_user_id' );

require_once BRICKS_MCP_BRIDGE_DIR . 'includes/class-bricks-mcp-tools.php';
require_once BRICKS_MCP_BRIDGE_DIR . 'includes/class-bricks-mcp-server.php';
require_once BRICKS_MCP_BRIDGE_DIR . 'includes/class-bricks-mcp-admin.php';

register_activation_hook( __FILE__, 'bricks_mcp_bridge_activate' );

function bricks_mcp_bridge_activate() {
	if ( ! get_option( BRICKS_MCP_BRIDGE_TOKEN_OPTION ) ) {
		// 64-char token without special chars so it is safe inside HTTP headers.
		update_option( BRICKS_MCP_BRIDGE_TOKEN_OPTION, wp_generate_password( 64, false, false ), false );
	}

	// Remember which user the MCP requests should act as (the activating admin).
	if ( ! get_option( BRICKS_MCP_BRIDGE_USER_OPTION ) && current_user_can( 'manage_options' ) ) {
		update_option( BRICKS_MCP_BRIDGE_USER_OPTION, get_current_user_id(), false );
	}
}

add_action( 'rest_api_init', array( 'Bricks_MCP_Server', 'register_routes' ) );
add_action( 'admin_menu', array( 'Bricks_MCP_Admin', 'register_menu' ) );
add_action( 'admin_post_bricks_mcp_bridge_regenerate_token', array( 'Bricks_MCP_Admin', 'handle_regenerate_token' ) );
