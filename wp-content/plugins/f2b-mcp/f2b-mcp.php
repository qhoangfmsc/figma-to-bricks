<?php
/**
 * Plugin Name: F2B MCP
 * Description: MCP server (Streamable HTTP) for Bricks 1.12.3 pages and templates. This project owns this copy. The generate pipeline still uses the local f2b bridge. Point Cursor at a site that has this plugin active when the test is on that site.
 * Version: 1.3.0
 * Author: figma-to-bricks
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'F2B_MCP_VERSION', '1.3.0' );
define( 'F2B_MCP_DIR', plugin_dir_path( __FILE__ ) );
define( 'F2B_MCP_REST_NAMESPACE', 'f2b-mcp/v1' );
define( 'F2B_MCP_TOKEN_OPTION', 'f2b_mcp_token' );
define( 'F2B_MCP_USER_OPTION', 'f2b_mcp_user_id' );

require_once F2B_MCP_DIR . 'includes/class-f2b-mcp-tools.php';
require_once F2B_MCP_DIR . 'includes/class-f2b-mcp-server.php';
require_once F2B_MCP_DIR . 'includes/class-f2b-mcp-admin.php';

register_activation_hook( __FILE__, 'f2b_mcp_activate' );

function f2b_mcp_activate() {
	if ( ! get_option( F2B_MCP_TOKEN_OPTION ) ) {
		// 64-char token without special chars so it is safe inside HTTP headers.
		update_option( F2B_MCP_TOKEN_OPTION, wp_generate_password( 64, false, false ), false );
	}

	// Remember which user the MCP requests should act as (the activating admin).
	if ( ! get_option( F2B_MCP_USER_OPTION ) && current_user_can( 'manage_options' ) ) {
		update_option( F2B_MCP_USER_OPTION, get_current_user_id(), false );
	}
}

add_action( 'rest_api_init', array( 'F2B_MCP_Server', 'register_routes' ) );
add_action( 'admin_menu', array( 'F2B_MCP_Admin', 'register_menu' ) );
add_action( 'admin_post_f2b_mcp_regenerate_token', array( 'F2B_MCP_Admin', 'handle_regenerate_token' ) );
