<?php
/**
 * Tool definitions and implementations for the Bricks MCP Bridge.
 *
 * Element data is exchanged as JSON strings to keep input schemas simple and
 * to allow pasting full "bricksCopiedElements" clipboard payloads directly.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bricks_MCP_Tools {

	/** Bricks element id: exactly 6 alphanumeric characters. */
	const ELEMENT_ID_PATTERN = '/^[a-zA-Z0-9]{6}$/';

	/**
	 * Tool descriptors as exposed via tools/list. No outputSchema on purpose.
	 */
	public static function definitions() {
		$elements_json_property = array(
			'type'        => 'string',
			'description' => 'JSON string. Either a Bricks elements array ([{id, name, parent, children, settings}, ...]) or a full bricksCopiedElements clipboard payload ({content: [...], globalClasses: [...]}). Each element id must be exactly 6 alphanumeric characters. Global classes found in a clipboard payload are merged automatically.',
		);

		$global_classes_property = array(
			'type'        => 'string',
			'description' => 'Optional JSON string with an array of Bricks global classes ([{id, name, settings}, ...]). Merged into the site-wide class registry by id.',
		);

		$page_settings_property = array(
			'type'        => 'string',
			'description' => 'Optional JSON object of Bricks page settings (merged into existing). Example: {"headerDisabled":true,"footerDisabled":true} — hides site header/footer on template preview for section-only screenshots.',
		);

		return array(
			array(
				'name'        => 'get_site_info',
				'description' => 'Read WordPress and Bricks Builder information for the connected site. Call this first to verify the connection.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => new stdClass(),
				),
			),
			array(
				'name'        => 'list_pages',
				'description' => 'List WordPress pages with their Bricks status (whether they are built with Bricks).',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'search'   => array( 'type' => 'string', 'description' => 'Optional search keyword for page titles.' ),
						'status'   => array( 'type' => 'string', 'description' => 'Post status filter: publish, draft, any. Default: any.' ),
						'per_page' => array( 'type' => 'integer', 'description' => 'Max results, default 20.' ),
					),
				),
			),
			array(
				'name'        => 'create_page',
				'description' => 'Create a WordPress page, enable Bricks editing on it, and optionally set its Bricks element content in one call.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'title'         => array( 'type' => 'string', 'description' => 'Page title.' ),
						'slug'          => array( 'type' => 'string', 'description' => 'Optional URL slug.' ),
						'status'        => array( 'type' => 'string', 'description' => 'publish or draft. Default: draft.' ),
						'elements_json' => $elements_json_property,
					),
					'required'   => array( 'title' ),
				),
			),
			array(
				'name'        => 'get_page',
				'description' => 'Read a page (or any post) including its Bricks element tree.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'page_id' => array( 'type' => 'integer', 'description' => 'Post ID.' ),
					),
					'required'   => array( 'page_id' ),
				),
			),
			array(
				'name'        => 'set_page_content',
				'description' => 'Replace the Bricks element content of a page (or any post) and enable the Bricks editor on it.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'page_id'             => array( 'type' => 'integer', 'description' => 'Post ID.' ),
						'elements_json'       => $elements_json_property,
						'global_classes_json' => $global_classes_property,
						'page_settings_json'  => $page_settings_property,
						'generate_css'        => array(
							'type'        => 'boolean',
							'description' => 'Alias of sync_css. When true, sync CSS after save (see sync_css).',
						),
						'sync_css'            => array(
							'type'        => 'boolean',
							'description' => 'After save: if Bricks uses External files → generate post-{id}.min.css; if Inline → no-op (success, no file). Safe on any site setting.',
						),
					),
					'required'   => array( 'page_id', 'elements_json' ),
				),
			),
			array(
				'name'        => 'list_templates',
				'description' => 'List Bricks templates, optionally filtered by type (header, footer, content, section, archive, search, error, popup).',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'type' => array( 'type' => 'string', 'description' => 'Optional template type filter.' ),
					),
				),
			),
			array(
				'name'        => 'create_template',
				'description' => 'Create a Bricks template of a given type and optionally set its element content in one call.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'title'         => array( 'type' => 'string', 'description' => 'Template title.' ),
						'type'          => array( 'type' => 'string', 'description' => 'Template type: header, footer, content, section, archive, search, error, popup.' ),
						'elements_json' => $elements_json_property,
					),
					'required'   => array( 'title', 'type' ),
				),
			),
			array(
				'name'        => 'get_template',
				'description' => 'Read a Bricks template including its element tree and template settings.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'template_id' => array( 'type' => 'integer', 'description' => 'Template post ID.' ),
					),
					'required'   => array( 'template_id' ),
				),
			),
			array(
				'name'        => 'set_template_content',
				'description' => 'Replace the Bricks element content of a template. The correct meta key (header/footer/content) is chosen automatically from the template type.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'template_id'         => array( 'type' => 'integer', 'description' => 'Template post ID.' ),
						'elements_json'       => $elements_json_property,
						'global_classes_json' => $global_classes_property,
						'page_settings_json'  => $page_settings_property,
						'generate_css'        => array(
							'type'        => 'boolean',
							'description' => 'Alias of sync_css. When true, sync CSS after save (see sync_css).',
						),
						'sync_css'            => array(
							'type'        => 'boolean',
							'description' => 'After save: if Bricks uses External files → generate post-{template_id}.min.css; if Inline → no-op (success, no file). Safe on any site setting.',
						),
					),
					'required'   => array( 'template_id', 'elements_json' ),
				),
			),
			array(
				'name'        => 'generate_css_file',
				'description' => 'Regenerate the external CSS file for a single page or template (post-{id}.min.css). Use after set_template_content during DO when Bricks CSS loading method is "External files". Does not regenerate the whole site.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'post_id'     => array(
							'type'        => 'integer',
							'description' => 'WordPress post ID (page or Bricks template).',
						),
						'template_id' => array(
							'type'        => 'integer',
							'description' => 'Alias for post_id when the target is a Bricks template.',
						),
					),
				),
			),
			array(
				'name'        => 'set_page_settings',
				'description' => 'Merge Bricks page settings (e.g. headerDisabled, footerDisabled) without re-uploading elements.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'page_id'            => array( 'type' => 'integer', 'description' => 'Post ID.' ),
						'template_id'        => array( 'type' => 'integer', 'description' => 'Template post ID.' ),
						'page_settings_json' => $page_settings_property,
					),
					'required'   => array( 'page_settings_json' ),
				),
			),
			array(
				'name'        => 'regenerate_css',
				'description' => 'Regenerate ALL Bricks external CSS files site-wide (same as Bricks > Settings > Performance > Regenerate CSS files). Prefer generate_css_file for a single template during DO.',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => new stdClass(),
				),
			),
			array(
				'name'        => 'upload_media',
				'description' => 'Upload a media file (PNG/JPG/WEBP/SVG/GIF) to the WordPress Media Library from base64 content. Returns attachment_id and url. Used to re-host build-time Figma cache assets (localhost:3845) so images resolve for real visitors on any environment (local or remote).',
				'inputSchema' => array(
					'type'       => 'object',
					'properties' => array(
						'filename'       => array(
							'type'        => 'string',
							'description' => 'File name including extension, e.g. hero-banner.png.',
						),
						'content_base64' => array(
							'type'        => 'string',
							'description' => 'Raw file bytes encoded as base64 (no data: URI prefix).',
						),
					),
					'required'   => array( 'filename', 'content_base64' ),
				),
			),
		);
	}

	public static function exists( $name ) {
		foreach ( self::definitions() as $tool ) {
			if ( $tool['name'] === $name ) {
				return true;
			}
		}
		return false;
	}

	public static function call( $name, array $args ) {
		switch ( $name ) {
			case 'get_site_info':
				return self::get_site_info();
			case 'list_pages':
				return self::list_pages( $args );
			case 'create_page':
				return self::create_page( $args );
			case 'get_page':
				return self::get_post_with_elements( (int) self::arg( $args, 'page_id' ) );
			case 'set_page_content':
				return self::set_page_content( $args );
			case 'list_templates':
				return self::list_templates( $args );
			case 'create_template':
				return self::create_template( $args );
			case 'get_template':
				return self::get_post_with_elements( (int) self::arg( $args, 'template_id' ) );
			case 'set_template_content':
				return self::set_template_content( $args );
			case 'set_page_settings':
				return self::set_page_settings_tool( $args );
			case 'generate_css_file':
				return self::generate_css_file( $args );
			case 'regenerate_css':
				return self::regenerate_css();
			case 'upload_media':
				return self::upload_media( $args );
		}

		return new WP_Error( 'unknown_tool', 'Unknown tool: ' . $name );
	}

	// ---------------------------------------------------------------- tools

	private static function get_site_info() {
		$theme = wp_get_theme();

		return array(
			'site_name'         => get_bloginfo( 'name' ),
			'site_url'          => home_url(),
			'wordpress_version' => get_bloginfo( 'version' ),
			'php_version'       => PHP_VERSION,
			'active_theme'      => $theme->get( 'Name' ) . ' ' . $theme->get( 'Version' ),
			'bricks_active'     => defined( 'BRICKS_VERSION' ),
			'bricks_version'    => defined( 'BRICKS_VERSION' ) ? BRICKS_VERSION : null,
			'css_loading'       => self::bricks_css_loading_method(),
			'css_loading_label' => self::bricks_css_loading_label(),
			'acting_as_user'    => wp_get_current_user()->user_login,
		);
	}

	private static function list_pages( array $args ) {
		$query = new WP_Query(
			array(
				'post_type'      => 'page',
				'post_status'    => self::arg( $args, 'status', 'any' ),
				's'              => self::arg( $args, 'search', '' ),
				'posts_per_page' => max( 1, min( 100, (int) self::arg( $args, 'per_page', 20 ) ) ),
				'orderby'        => 'modified',
				'order'          => 'DESC',
			)
		);

		$pages = array();
		foreach ( $query->posts as $post ) {
			$pages[] = array(
				'id'        => $post->ID,
				'title'     => $post->post_title,
				'slug'      => $post->post_name,
				'status'    => $post->post_status,
				'url'       => get_permalink( $post ),
				'is_bricks' => get_post_meta( $post->ID, self::meta_key_editor_mode(), true ) === 'bricks',
			);
		}

		return array( 'total' => (int) $query->found_posts, 'pages' => $pages );
	}

	private static function create_page( array $args ) {
		$title = trim( (string) self::arg( $args, 'title' ) );
		if ( '' === $title ) {
			return new WP_Error( 'missing_title', 'title is required.' );
		}

		$status = self::arg( $args, 'status', 'draft' );
		if ( ! in_array( $status, array( 'publish', 'draft' ), true ) ) {
			return new WP_Error( 'bad_status', 'status must be publish or draft.' );
		}

		$page_id = wp_insert_post(
			array(
				'post_title'  => $title,
				'post_name'   => sanitize_title( (string) self::arg( $args, 'slug', '' ) ),
				'post_type'   => 'page',
				'post_status' => $status,
			),
			true
		);

		if ( is_wp_error( $page_id ) ) {
			return $page_id;
		}

		update_post_meta( $page_id, self::meta_key_editor_mode(), 'bricks' );

		$elements_result = null;
		$elements_json   = (string) self::arg( $args, 'elements_json', '' );
		if ( '' !== $elements_json ) {
			$elements_result = self::write_elements( $page_id, $elements_json, '', self::meta_key_content() );
			if ( is_wp_error( $elements_result ) ) {
				return $elements_result;
			}
		}

		return array(
			'page_id'  => $page_id,
			'url'      => get_permalink( $page_id ),
			'edit_url' => self::builder_edit_url( $page_id ),
			'status'   => $status,
			'elements' => $elements_result ? $elements_result : 'No elements set. Use set_page_content to add Bricks content.',
		);
	}

	private static function set_page_content( array $args ) {
		$page_id = (int) self::arg( $args, 'page_id' );
		$post    = get_post( $page_id );

		if ( ! $post ) {
			return new WP_Error( 'not_found', 'No post found with ID ' . $page_id );
		}

		update_post_meta( $page_id, self::meta_key_editor_mode(), 'bricks' );

		$result = self::write_elements(
			$page_id,
			(string) self::arg( $args, 'elements_json', '' ),
			(string) self::arg( $args, 'global_classes_json', '' ),
			self::meta_key_content()
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$page_settings_result = self::maybe_write_page_settings( $page_id, $args );
		if ( is_wp_error( $page_settings_result ) ) {
			return $page_settings_result;
		}
		if ( is_array( $page_settings_result ) ) {
			$result['page_settings'] = $page_settings_result;
		}

		$result['page_id']  = $page_id;
		$result['url']      = get_permalink( $page_id );
		$result['edit_url'] = self::builder_edit_url( $page_id );

		if ( self::should_sync_css( $args ) ) {
			$css_result = self::sync_css_after_save( $page_id );
			if ( is_wp_error( $css_result ) ) {
				return $css_result;
			}
			$result['css_sync'] = $css_result;
		}

		return $result;
	}

	private static function list_templates( array $args ) {
		$type  = (string) self::arg( $args, 'type', '' );
		$query = array(
			'post_type'      => self::template_post_type(),
			'post_status'    => 'any',
			'posts_per_page' => 100,
		);

		if ( '' !== $type ) {
			$query['meta_key']   = self::meta_key_template_type();
			$query['meta_value'] = $type;
		}

		$templates = array();
		foreach ( get_posts( $query ) as $post ) {
			$templates[] = array(
				'id'    => $post->ID,
				'title' => $post->post_title,
				'type'  => get_post_meta( $post->ID, self::meta_key_template_type(), true ),
			);
		}

		return array( 'templates' => $templates );
	}

	private static function create_template( array $args ) {
		$title = trim( (string) self::arg( $args, 'title' ) );
		$type  = (string) self::arg( $args, 'type' );

		$valid_types = array( 'header', 'footer', 'content', 'section', 'archive', 'search', 'error', 'popup', 'password_protection' );
		if ( ! in_array( $type, $valid_types, true ) ) {
			return new WP_Error( 'bad_type', 'type must be one of: ' . implode( ', ', $valid_types ) );
		}
		if ( '' === $title ) {
			return new WP_Error( 'missing_title', 'title is required.' );
		}

		$template_id = wp_insert_post(
			array(
				'post_title'  => $title,
				'post_type'   => self::template_post_type(),
				'post_status' => 'publish',
			),
			true
		);

		if ( is_wp_error( $template_id ) ) {
			return $template_id;
		}

		update_post_meta( $template_id, self::meta_key_template_type(), $type );

		$elements_result = null;
		$elements_json   = (string) self::arg( $args, 'elements_json', '' );
		if ( '' !== $elements_json ) {
			$elements_result = self::write_elements( $template_id, $elements_json, '', self::content_meta_key_for_type( $type ) );
			if ( is_wp_error( $elements_result ) ) {
				return $elements_result;
			}
		}

		return array(
			'template_id' => $template_id,
			'type'        => $type,
			'edit_url'    => self::builder_edit_url( $template_id ),
			'elements'    => $elements_result ? $elements_result : 'No elements set. Use set_template_content to add Bricks content.',
		);
	}

	private static function set_template_content( array $args ) {
		$template_id = (int) self::arg( $args, 'template_id' );
		$post        = get_post( $template_id );

		if ( ! $post || $post->post_type !== self::template_post_type() ) {
			return new WP_Error( 'not_found', 'No Bricks template found with ID ' . $template_id );
		}

		$type   = (string) get_post_meta( $template_id, self::meta_key_template_type(), true );
		$result = self::write_elements(
			$template_id,
			(string) self::arg( $args, 'elements_json', '' ),
			(string) self::arg( $args, 'global_classes_json', '' ),
			self::content_meta_key_for_type( $type )
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$page_settings_result = self::maybe_write_page_settings( $template_id, $args );
		if ( is_wp_error( $page_settings_result ) ) {
			return $page_settings_result;
		}
		if ( is_array( $page_settings_result ) ) {
			$result['page_settings'] = $page_settings_result;
		}

		$result['template_id'] = $template_id;
		$result['type']        = $type;
		$result['edit_url']    = self::builder_edit_url( $template_id );

		if ( self::should_sync_css( $args ) ) {
			$css_result = self::sync_css_after_save( $template_id );
			if ( is_wp_error( $css_result ) ) {
				return $css_result;
			}
			$result['css_sync'] = $css_result;
		}

		return $result;
	}

	private static function set_page_settings_tool( array $args ) {
		$post_id = (int) self::arg( $args, 'template_id', 0 );
		if ( ! $post_id ) {
			$post_id = (int) self::arg( $args, 'page_id', 0 );
		}
		if ( ! $post_id ) {
			return new WP_Error( 'missing_post_id', 'template_id or page_id is required.' );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new WP_Error( 'not_found', 'No post found with ID ' . $post_id );
		}

		$result = self::write_page_settings( $post_id, (string) self::arg( $args, 'page_settings_json', '' ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$result['post_id']  = $post_id;
		$result['edit_url'] = self::builder_edit_url( $post_id );
		return $result;
	}

	private static function get_post_with_elements( $post_id ) {
		$post = get_post( $post_id );

		if ( ! $post ) {
			return new WP_Error( 'not_found', 'No post found with ID ' . $post_id );
		}

		$is_template = $post->post_type === self::template_post_type();
		$type        = $is_template ? (string) get_post_meta( $post_id, self::meta_key_template_type(), true ) : '';
		$meta_key    = $is_template ? self::content_meta_key_for_type( $type ) : self::meta_key_content();
		$elements    = get_post_meta( $post_id, $meta_key, true );
		$page_settings = self::read_page_settings( $post_id );

		return array(
			'id'            => $post->ID,
			'title'         => $post->post_title,
			'post_type'     => $post->post_type,
			'status'        => $post->post_status,
			'template_type' => $type ? $type : null,
			'url'           => get_permalink( $post ),
			'edit_url'      => self::builder_edit_url( $post->ID ),
			'elements'      => is_array( $elements ) ? $elements : array(),
			'page_settings' => $page_settings,
		);
	}

	private static function generate_css_file( array $args ) {
		if ( ! defined( 'BRICKS_VERSION' ) ) {
			return new WP_Error( 'bricks_inactive', 'Bricks Builder is not active.' );
		}

		$post_id = (int) self::arg( $args, 'post_id', 0 );
		if ( ! $post_id ) {
			$post_id = (int) self::arg( $args, 'template_id', 0 );
		}
		if ( ! $post_id ) {
			return new WP_Error( 'missing_post_id', 'post_id or template_id is required.' );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new WP_Error( 'not_found', 'No post found with ID ' . $post_id );
		}

		$css_loading = self::bricks_css_loading_method();
		if ( 'file' !== $css_loading ) {
			return array(
				'synced'      => true,
				'generated'   => false,
				'post_id'     => $post_id,
				'css_loading' => $css_loading,
				'note'        => 'Inline mode — CSS is compiled on page render; no external file to generate.',
			);
		}

		$payload = self::resolve_post_elements_for_css( $post_id );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		if ( ! is_callable( array( '\Bricks\Assets_Files', 'generate_post_css_file' ) ) ) {
			return new WP_Error(
				'unsupported_bricks',
				'Bricks\\Assets_Files::generate_post_css_file is not available in this Bricks version.'
			);
		}

		$file_name = \Bricks\Assets_Files::generate_post_css_file(
			$post_id,
			$payload['content_type'],
			$payload['elements']
		);

		if ( ! $file_name ) {
			return array(
				'generated'    => false,
				'post_id'      => $post_id,
				'content_type' => $payload['content_type'],
				'note'         => 'No CSS output (empty elements or generation skipped).',
			);
		}

		$css_dir  = class_exists( '\Bricks\Assets' ) ? \Bricks\Assets::$css_dir : '';
		$file_url = '';
		if ( class_exists( '\Bricks\Assets' ) && \Bricks\Assets::$css_url ) {
			$file_url = trailingslashit( \Bricks\Assets::$css_url ) . $file_name;
		} elseif ( $css_dir ) {
			$file_url = trailingslashit( str_replace( ABSPATH, trailingslashit( site_url() ), $css_dir ) ) . $file_name;
		}

		return array(
			'generated'    => true,
			'synced'       => true,
			'post_id'      => $post_id,
			'file_name'    => $file_name,
			'file_path'    => $css_dir ? $css_dir . '/' . $file_name : null,
			'file_url'     => $file_url ? $file_url : null,
			'content_type' => $payload['content_type'],
			'via'          => 'Bricks\\Assets_Files::generate_post_css_file',
		);
	}

	private static function regenerate_css() {
		// Bricks internals differ between versions; try known entry points defensively.
		$candidates = array(
			array( '\Bricks\Assets_Files', 'regenerate_css_files' ),
			array( '\Bricks\Assets', 'regenerate_css_files' ),
			array( '\Bricks\Files', 'regenerate_css_files' ),
		);

		foreach ( $candidates as $callback ) {
			if ( is_callable( $callback ) ) {
				call_user_func( $callback );
				return array( 'regenerated' => true, 'via' => implode( '::', $callback ) );
			}
		}

		return array(
			'regenerated' => false,
			'note'        => 'No known regeneration entry point found in this Bricks version. Run "wp bricks regenerate_assets" via WP-CLI, or use the "Inline styles" CSS loading method (Bricks > Settings > Performance) which needs no regeneration.',
		);
	}

	/**
	 * Uploads a base64-encoded file into the Media Library.
	 *
	 * SVG is allowed explicitly: WordPress core blocks it by default, but this
	 * endpoint is token-authenticated and the same token already grants
	 * arbitrary page-settings script injection by design, so SVG is not a
	 * privilege escalation here. Files come from the operator's own Figma.
	 */
	private static function upload_media( array $args ) {
		$filename       = sanitize_file_name( (string) self::arg( $args, 'filename', '' ) );
		$content_base64 = (string) self::arg( $args, 'content_base64', '' );

		if ( '' === $filename || '' === $content_base64 ) {
			return new WP_Error( 'missing_args', 'Both "filename" and "content_base64" are required.' );
		}

		$bytes = base64_decode( $content_base64, true );
		if ( false === $bytes || '' === $bytes ) {
			return new WP_Error( 'bad_base64', 'content_base64 is not valid base64.' );
		}

		$allowed_mimes = array_merge(
			wp_get_mime_types(),
			array(
				'svg'  => 'image/svg+xml',
				'webp' => 'image/webp',
			)
		);
		$filetype = wp_check_filetype( $filename, $allowed_mimes );
		if ( empty( $filetype['type'] ) ) {
			return new WP_Error( 'bad_filetype', 'File type not allowed: ' . $filename );
		}

		$upload = wp_upload_bits( $filename, null, $bytes );
		if ( ! empty( $upload['error'] ) ) {
			return new WP_Error( 'upload_failed', $upload['error'] );
		}

		$attachment_id = wp_insert_attachment(
			array(
				'post_mime_type' => $filetype['type'],
				'post_title'     => sanitize_text_field( pathinfo( $filename, PATHINFO_FILENAME ) ),
				'post_content'   => '',
				'post_status'    => 'inherit',
			),
			$upload['file']
		);
		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		$metadata = wp_generate_attachment_metadata( $attachment_id, $upload['file'] );
		if ( ! empty( $metadata ) ) {
			wp_update_attachment_metadata( $attachment_id, $metadata );
		}

		return array(
			'attachment_id' => (int) $attachment_id,
			'url'           => $upload['url'],
			'mime_type'     => $filetype['type'],
			'bytes'         => strlen( $bytes ),
		);
	}

	// -------------------------------------------------------------- helpers

	/**
	 * Parses, validates, and saves an elements payload; merges global classes.
	 */
	private static function write_elements( $post_id, $elements_json, $global_classes_json, $meta_key ) {
		$decoded = json_decode( $elements_json, true );

		if ( null === $decoded && JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_Error( 'bad_json', 'elements_json is not valid JSON: ' . json_last_error_msg() );
		}

		$global_classes = array();

		// Accept full bricksCopiedElements clipboard payloads transparently.
		if ( is_array( $decoded ) && isset( $decoded['content'] ) && is_array( $decoded['content'] ) ) {
			if ( isset( $decoded['globalClasses'] ) && is_array( $decoded['globalClasses'] ) ) {
				$global_classes = $decoded['globalClasses'];
			}
			$decoded = $decoded['content'];
		}

		$validation = self::validate_elements( $decoded );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		if ( '' !== $global_classes_json ) {
			$extra_classes = json_decode( $global_classes_json, true );
			if ( ! is_array( $extra_classes ) ) {
				return new WP_Error( 'bad_classes_json', 'global_classes_json must be a JSON array of class objects.' );
			}
			$global_classes = array_merge( $global_classes, $extra_classes );
		}

		$classes_added = $global_classes ? self::merge_global_classes( $global_classes ) : 0;

		update_post_meta( $post_id, $meta_key, wp_slash( $decoded ) );

		return array(
			'saved_elements'       => count( $decoded ),
			'meta_key'             => $meta_key,
			'global_classes_added' => $classes_added,
		);
	}

	private static function meta_key_page_settings() {
		return defined( 'BRICKS_DB_PAGE_SETTINGS' ) ? BRICKS_DB_PAGE_SETTINGS : '_bricks_page_settings';
	}

	private static function read_page_settings( $post_id ) {
		$settings = get_post_meta( $post_id, self::meta_key_page_settings(), true );
		return is_array( $settings ) ? $settings : array();
	}

	/**
	 * Merge page settings when page_settings_json is present in tool args.
	 *
	 * @return array|null|WP_Error
	 */
	private static function maybe_write_page_settings( $post_id, array $args ) {
		$page_settings_json = (string) self::arg( $args, 'page_settings_json', '' );
		if ( '' === $page_settings_json ) {
			return null;
		}
		return self::write_page_settings( $post_id, $page_settings_json );
	}

	private static function write_page_settings( $post_id, $page_settings_json ) {
		$decoded = json_decode( $page_settings_json, true );

		if ( null === $decoded && JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_Error( 'bad_page_settings_json', 'page_settings_json is not valid JSON: ' . json_last_error_msg() );
		}

		if ( ! is_array( $decoded ) ) {
			return new WP_Error( 'bad_page_settings', 'page_settings_json must be a JSON object.' );
		}

		$existing = self::read_page_settings( $post_id );
		$merged   = array_merge( $existing, $decoded );

		update_post_meta( $post_id, self::meta_key_page_settings(), $merged );

		return array(
			'saved_page_settings' => $merged,
			'meta_key'            => self::meta_key_page_settings(),
		);
	}

	private static function validate_elements( $elements ) {
		if ( ! is_array( $elements ) ) {
			return new WP_Error( 'bad_elements', 'Elements payload must be a JSON array of element objects.' );
		}

		$ids = array();
		foreach ( $elements as $index => $element ) {
			if ( ! is_array( $element ) || empty( $element['id'] ) || empty( $element['name'] ) ) {
				return new WP_Error( 'bad_element', 'Element at index ' . $index . ' must have "id" and "name".' );
			}
			$eid = (string) $element['id'];
			if ( ! preg_match( self::ELEMENT_ID_PATTERN, $eid ) ) {
				return new WP_Error(
					'bad_element_id',
					'Element at index ' . $index . ' has invalid id "' . $eid . '": must be exactly 6 alphanumeric characters.'
				);
			}
			$ids[ $eid ] = true;
		}

		// Catch dangling references early: they render as broken trees in the builder.
		foreach ( $elements as $element ) {
			$parent = isset( $element['parent'] ) ? $element['parent'] : 0;
			if ( $parent && 0 !== $parent && '0' !== $parent && ! isset( $ids[ (string) $parent ] ) ) {
				return new WP_Error( 'bad_parent', 'Element "' . $element['id'] . '" references missing parent "' . $parent . '".' );
			}
			if ( ! empty( $element['children'] ) && is_array( $element['children'] ) ) {
				foreach ( $element['children'] as $child_id ) {
					if ( ! isset( $ids[ (string) $child_id ] ) ) {
						return new WP_Error( 'bad_child', 'Element "' . $element['id'] . '" references missing child "' . $child_id . '".' );
					}
				}
			}
		}

		return true;
	}

	/**
	 * Merges classes into the site-wide registry, de-duplicated by id and name.
	 *
	 * @return int Number of newly added classes.
	 */
	private static function merge_global_classes( array $new_classes ) {
		$existing = get_option( 'bricks_global_classes', array() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}

		$known_ids   = array();
		$known_names = array();
		foreach ( $existing as $class ) {
			if ( isset( $class['id'] ) ) {
				$known_ids[ (string) $class['id'] ] = true;
			}
			if ( isset( $class['name'] ) ) {
				$known_names[ (string) $class['name'] ] = true;
			}
		}

		$added = 0;
		foreach ( $new_classes as $class ) {
			if ( ! is_array( $class ) || empty( $class['id'] ) || empty( $class['name'] ) ) {
				continue;
			}
			if ( isset( $known_ids[ (string) $class['id'] ] ) || isset( $known_names[ (string) $class['name'] ] ) ) {
				continue;
			}
			$existing[] = $class;
			$known_ids[ (string) $class['id'] ]     = true;
			$known_names[ (string) $class['name'] ] = true;
			$added++;
		}

		if ( $added > 0 ) {
			update_option( 'bricks_global_classes', $existing );
		}

		return $added;
	}

	private static function builder_edit_url( $post_id ) {
		return add_query_arg( 'bricks', 'run', get_permalink( $post_id ) );
	}

	private static function template_post_type() {
		return defined( 'BRICKS_DB_TEMPLATE_SLUG' ) ? BRICKS_DB_TEMPLATE_SLUG : 'bricks_template';
	}

	private static function meta_key_editor_mode() {
		return defined( 'BRICKS_DB_EDITOR_MODE' ) ? BRICKS_DB_EDITOR_MODE : '_bricks_editor_mode';
	}

	private static function meta_key_content() {
		return defined( 'BRICKS_DB_PAGE_CONTENT' ) ? BRICKS_DB_PAGE_CONTENT : '_bricks_page_content_2';
	}

	private static function meta_key_template_type() {
		return defined( 'BRICKS_DB_TEMPLATE_TYPE' ) ? BRICKS_DB_TEMPLATE_TYPE : '_bricks_template_type';
	}

	private static function content_meta_key_for_type( $type ) {
		if ( 'header' === $type ) {
			return defined( 'BRICKS_DB_PAGE_HEADER' ) ? BRICKS_DB_PAGE_HEADER : '_bricks_page_header_2';
		}
		if ( 'footer' === $type ) {
			return defined( 'BRICKS_DB_PAGE_FOOTER' ) ? BRICKS_DB_PAGE_FOOTER : '_bricks_page_footer_2';
		}
		return self::meta_key_content();
	}

	private static function arg( array $args, $key, $default = null ) {
		return isset( $args[ $key ] ) ? $args[ $key ] : $default;
	}

	/**
	 * True when sync_css or generate_css is set on upload args.
	 */
	private static function should_sync_css( array $args ) {
		if ( array_key_exists( 'sync_css', $args ) ) {
			return (bool) $args['sync_css'];
		}
		return (bool) self::arg( $args, 'generate_css', false );
	}

	/**
	 * After programmatic save: external → generate file; inline → success no-op.
	 *
	 * @param int $post_id
	 * @return array|WP_Error
	 */
	private static function sync_css_after_save( $post_id ) {
		return self::generate_css_file( array( 'post_id' => (int) $post_id ) );
	}

	/**
	 * Bricks setting: inline (default) or external CSS files.
	 */
	private static function bricks_css_loading_method() {
		if ( ! class_exists( '\Bricks\Database' ) ) {
			return 'unknown';
		}
		$method = \Bricks\Database::get_setting( 'cssLoading' );
		return $method ? $method : 'inline';
	}

	private static function bricks_css_loading_label() {
		return 'file' === self::bricks_css_loading_method() ? 'External files' : 'Inline styles';
	}

	/**
	 * Resolve Bricks content type + elements for a post/template (mirrors Bricks regenerate_css_file).
	 *
	 * @return array{content_type:string,elements:array}|WP_Error
	 */
	private static function resolve_post_elements_for_css( $post_id ) {
		$post_type    = get_post_type( $post_id );
		$elements     = false;
		$content_type = 'content';

		if ( $post_type === self::template_post_type() ) {
			$header_meta = defined( 'BRICKS_DB_PAGE_HEADER' ) ? BRICKS_DB_PAGE_HEADER : '_bricks_page_header_2';
			$footer_meta = defined( 'BRICKS_DB_PAGE_FOOTER' ) ? BRICKS_DB_PAGE_FOOTER : '_bricks_page_footer_2';
			$content_meta = self::meta_key_content();

			$elements = get_post_meta( $post_id, $header_meta, true );
			if ( $elements ) {
				$content_type = 'header';
			} else {
				$elements = get_post_meta( $post_id, $footer_meta, true );
				if ( $elements ) {
					$content_type = 'footer';
				}
			}

			if ( ! $elements ) {
				$elements = get_post_meta( $post_id, $content_meta, true );
				$content_type = 'content';
			}
		} else {
			$elements = get_post_meta( $post_id, self::meta_key_content(), true );
		}

		if ( ! is_array( $elements ) || empty( $elements ) ) {
			return new WP_Error( 'no_elements', 'No Bricks elements found for post ID ' . $post_id );
		}

		return array(
			'content_type' => $content_type,
			'elements'     => $elements,
		);
	}
}
