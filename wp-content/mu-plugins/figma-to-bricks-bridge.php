<?php
/**
 * Plugin Name: Figma to Bricks Bridge
 * Description: REST bridge (f2b/v1) to read/write Bricks templates, global classes and element schemas on Bricks 1.9.x, which has no official API for it.
 *
 * Auth: WordPress Application Passwords (user needs manage_options).
 */

defined( 'ABSPATH' ) || exit;

final class F2B_Bridge {
	const NS = 'f2b/v1';

	// Template types accepted by Bricks 1.9.x
	const TYPES = [ 'header', 'footer', 'section', 'content', 'archive', 'search', 'error', 'popup' ];

	const FONTS_OPTION = 'f2b_google_fonts';

	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'routes' ] );
		add_action( 'wp_head', [ __CLASS__, 'print_fonts' ], 1 );
		// local font faces come LAST, in the footer: Bricks adds its own Google Fonts stylesheet for the same family at the end of <head> (whatever the priority), and for
		// equal family / weight / style the face defined last wins
		add_action( 'wp_footer', [ __CLASS__, 'print_local_faces' ], 1 );
	}

	private static $local_faces = '';

	public static function print_local_faces() {
		if ( self::$local_faces ) {
			echo '<style id="f2b-local-fonts">' . self::$local_faces . '</style>' . "\n";
		}
	}

	/** Google Fonts used by pipeline templates: { 'Inter' => [ 'w' => [400,700], 'i' => [400] ] } */
	public static function print_fonts() {
		$fonts = get_option( self::FONTS_OPTION, [] );
		if ( ! $fonts ) {
			return;
		}

		$parts = [];
		$faces = '';
		foreach ( $fonts as $family => $f ) {
			$w = array_values( array_unique( array_map( 'intval', $f['w'] ?? [] ) ) );
			$i = array_values( array_unique( array_map( 'intval', $f['i'] ?? [] ) ) );
			sort( $w );
			sort( $i );
			// Optional: font files placed in mu-plugins/figma-to-bricks-fonts/<Family>/<weight>.woff2 replace Google's for those weights (Figma lays text out with its own
			// Inter 3.x; Google serves Inter 4, whose Vietnamese capitals are up to 2% wider). Remove the folder to go back to Google Fonts only.
			$local = [];
			$slug  = sanitize_file_name( $family );
			foreach ( $w as $weight ) {
				if ( file_exists( WPMU_PLUGIN_DIR . "/figma-to-bricks-fonts/$slug/$weight.woff2" ) ) {
					$local[] = $weight;
					$faces  .= "@font-face{font-family:'" . esc_attr( $family ) . "';font-style:normal;font-weight:$weight;font-display:swap;src:url('/wp-content/mu-plugins/figma-to-bricks-fonts/" . rawurlencode( $slug ) . "/$weight.woff2') format('woff2')}";
				}
			}
			$w = array_values( array_diff( $w, $local ) );
			if ( ! $w && ! $i ) {
				continue;
			}
			if ( $i ) {
				$pairs = array_merge( array_map( fn( $x ) => "0,$x", $w ), array_map( fn( $x ) => "1,$x", $i ) );
				$parts[] = 'family=' . rawurlencode( $family ) . ':ital,wght@' . implode( ';', $pairs );
			} else {
				$parts[] = 'family=' . rawurlencode( $family ) . ( $w ? ':wght@' . implode( ';', $w ) : '' );
			}
		}

		self::$local_faces = $faces;
		if ( ! $parts ) {
			return;
		}
		echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
		echo '<link rel="stylesheet" href="' . esc_url( 'https://fonts.googleapis.com/css2?' . implode( '&', $parts ) . '&display=swap' ) . '">' . "\n";
	}

	public static function can() {
		return current_user_can( 'manage_options' );
	}

	public static function routes() {
		$p = [ 'permission_callback' => [ __CLASS__, 'can' ] ];
		$r = fn( $route, $args ) => register_rest_route( self::NS, $route, $args );

		$r( '/templates', [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'list_templates' ] ] + $p,
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_template' ] ] + $p,
		] );
		$r( '/templates/(?P<id>\d+)', [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_template' ] ] + $p,
			[ 'methods' => 'PUT', 'callback' => [ __CLASS__, 'update_template' ] ] + $p,
			[ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'trash_template' ] ] + $p,
		] );
		$r( '/global-classes', [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_classes' ] ] + $p,
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'upsert_classes' ] ] + $p,
		] );
		$r( '/preview/(?P<id>\d+)', [ [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'preview' ] ] + $p ] );
		$r( '/preview', [ [ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'preview_cleanup' ] ] + $p ] );
		$r( '/page', [ [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'assemble_page' ] ] + $p ] );
		$r( '/fonts', [
			[ 'methods' => 'GET', 'callback' => fn() => get_option( self::FONTS_OPTION, [] ) ] + $p,
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'set_fonts' ] ] + $p,
		] );
		$r( '/media', [ [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'upload_media' ] ] + $p ] );
		$r( '/elements', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'list_elements' ] ] + $p ] );
		$r( '/elements/(?P<name>[a-z0-9-]+)', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'element_schema' ] ] + $p ] );
	}

	/** Meta key that holds the elements for a template type */
	private static function meta_key( $type ) {
		return $type === 'header' ? BRICKS_DB_PAGE_HEADER : ( $type === 'footer' ? BRICKS_DB_PAGE_FOOTER : BRICKS_DB_PAGE_CONTENT );
	}

	private static function shape( $post, $with_content = false ) {
		$type = get_post_meta( $post->ID, BRICKS_DB_TEMPLATE_TYPE, true );
		$els  = get_post_meta( $post->ID, self::meta_key( $type ), true );
		$els  = is_array( $els ) ? $els : [];

		$out = [
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'type'         => $type,
			'status'       => $post->post_status,
			'elementCount' => count( $els ),
			'builderUrl'   => add_query_arg( 'bricks', 'run', get_permalink( $post->ID ) ),
		];

		if ( $with_content ) {
			$out['content'] = $els;
		}

		return $out;
	}

	private static function find( $id ) {
		$post = get_post( (int) $id );
		return ( $post && $post->post_type === BRICKS_DB_TEMPLATE_SLUG ) ? $post : null;
	}

	/**
	 * Validate and normalise a flat Bricks element array.
	 * Callers only need to set `parent`; `children` is rebuilt from it, and missing ids are generated.
	 *
	 * @return array|WP_Error
	 */
	private static function normalize( $elements ) {
		if ( ! is_array( $elements ) ) {
			return new WP_Error( 'f2b_invalid', 'content must be an array of elements', [ 'status' => 400 ] );
		}

		$elements = array_values( $elements );
		$ids      = [];

		foreach ( $elements as $i => $el ) {
			if ( ! is_array( $el ) || empty( $el['name'] ) || ! is_string( $el['name'] ) ) {
				return new WP_Error( 'f2b_invalid', "element #$i needs a string 'name'", [ 'status' => 400 ] );
			}

			if ( empty( $el['id'] ) ) {
				$el['id'] = \Bricks\Helpers::generate_random_id( false );
			}

			if ( isset( $ids[ $el['id'] ] ) ) {
				return new WP_Error( 'f2b_invalid', "duplicate element id '{$el['id']}'", [ 'status' => 400 ] );
			}

			$ids[ $el['id'] ] = true;

			$el['parent']   = empty( $el['parent'] ) ? 0 : $el['parent'];
			$el['children'] = [];
			$el['settings'] = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : [];

			$elements[ $i ] = $el;
		}

		$by_id = [];
		foreach ( $elements as $i => $el ) {
			$by_id[ $el['id'] ] = $i;
		}

		foreach ( $elements as $el ) {
			if ( $el['parent'] === 0 ) {
				continue;
			}

			if ( ! isset( $by_id[ $el['parent'] ] ) ) {
				return new WP_Error( 'f2b_invalid', "element '{$el['id']}' has unknown parent '{$el['parent']}'", [ 'status' => 400 ] );
			}

			$elements[ $by_id[ $el['parent'] ] ]['children'][] = $el['id'];
		}

		return $elements;
	}

	private static function save_elements( $post_id, $type, $elements ) {
		// wp_slash: update_post_meta unslashes, which would strip backslashes (custom CSS/code)
		update_post_meta( $post_id, self::meta_key( $type ), wp_slash( $elements ) );
	}

	public static function list_templates( $req ) {
		$q = [
			'post_type'      => BRICKS_DB_TEMPLATE_SLUG,
			'post_status'    => 'any',
			'posts_per_page' => 200,
		];

		return array_map( [ __CLASS__, 'shape' ], get_posts( $q ) );
	}

	public static function get_template( $req ) {
		$post = self::find( $req['id'] );
		return $post ? self::shape( $post, true ) : new WP_Error( 'f2b_not_found', 'template not found', [ 'status' => 404 ] );
	}

	public static function create_template( $req ) {
		$type  = $req['type'] ?? 'section';
		$title = trim( (string) ( $req['title'] ?? '' ) );

		if ( ! in_array( $type, self::TYPES, true ) ) {
			return new WP_Error( 'f2b_invalid', 'type must be one of: ' . implode( ', ', self::TYPES ), [ 'status' => 400 ] );
		}

		$elements = self::normalize( $req['content'] ?? [] );
		if ( is_wp_error( $elements ) ) {
			return $elements;
		}

		$id = wp_insert_post( [
			'post_type'   => BRICKS_DB_TEMPLATE_SLUG,
			'post_status' => 'publish',
			'post_title'  => $title !== '' ? $title : '(no title)',
		], true );

		if ( is_wp_error( $id ) ) {
			return $id;
		}

		update_post_meta( $id, BRICKS_DB_TEMPLATE_TYPE, $type );
		self::save_elements( $id, $type, $elements );

		return self::shape( get_post( $id ), true );
	}

	public static function update_template( $req ) {
		$post = self::find( $req['id'] );
		if ( ! $post ) {
			return new WP_Error( 'f2b_not_found', 'template not found', [ 'status' => 404 ] );
		}

		$type = get_post_meta( $post->ID, BRICKS_DB_TEMPLATE_TYPE, true );

		if ( isset( $req['title'] ) ) {
			wp_update_post( [ 'ID' => $post->ID, 'post_title' => (string) $req['title'] ] );
		}

		if ( isset( $req['content'] ) ) {
			$elements = self::normalize( $req['content'] );
			if ( is_wp_error( $elements ) ) {
				return $elements;
			}
			self::save_elements( $post->ID, $type, $elements );
		}

		return self::shape( get_post( $post->ID ), true );
	}

	public static function trash_template( $req ) {
		$post = self::find( $req['id'] );
		if ( ! $post ) {
			return new WP_Error( 'f2b_not_found', 'template not found', [ 'status' => 404 ] );
		}

		wp_trash_post( $post->ID );
		return [ 'trashed' => $post->ID ];
	}

	public static function get_classes() {
		return get_option( BRICKS_DB_GLOBAL_CLASSES, [] );
	}

	/** Upsert global classes by name: body { classes: [ { name, settings } ] } */
	public static function upsert_classes( $req ) {
		$incoming = $req['classes'] ?? null;
		if ( ! is_array( $incoming ) ) {
			return new WP_Error( 'f2b_invalid', 'classes must be an array of { name, settings }', [ 'status' => 400 ] );
		}

		$classes = get_option( BRICKS_DB_GLOBAL_CLASSES, [] );
		$by_name = [];
		foreach ( $classes as $i => $c ) {
			$by_name[ $c['name'] ?? '' ] = $i;
		}

		$result = [];
		foreach ( $incoming as $c ) {
			if ( empty( $c['name'] ) ) {
				return new WP_Error( 'f2b_invalid', "each class needs a 'name'", [ 'status' => 400 ] );
			}

			$settings = isset( $c['settings'] ) && is_array( $c['settings'] ) ? $c['settings'] : [];

			if ( isset( $by_name[ $c['name'] ] ) ) {
				$classes[ $by_name[ $c['name'] ] ]['settings'] = $settings;
				$result[]                                      = $classes[ $by_name[ $c['name'] ] ];
			} else {
				$new       = [ 'id' => \Bricks\Helpers::generate_random_id( false ), 'name' => $c['name'], 'settings' => $settings ];
				$classes[] = $new;
				$result[]  = $new;
			}
		}

		update_option( BRICKS_DB_GLOBAL_CLASSES, wp_slash( $classes ) );
		return $result;
	}

	/**
	 * Add a file to the media library. Body: { data_base64 | url, filename?, title? }
	 * De-duplicated by sha256 (meta _f2b_sha256), so re-running a pipeline never creates copies.
	 * Returns the Bricks image setting shape { id, url, filename, size }
	 */
	public static function upload_media( $req ) {
		// SVG is blocked by WordPress by default; this endpoint is admin-only and the files come from Figma renders
		add_filter( 'upload_mimes', fn( $m ) => $m + [ 'svg' => 'image/svg+xml' ] );
		add_filter( 'wp_check_filetype_and_ext', function ( $d, $file, $name ) {
			return preg_match( '/\\.svg$/i', $name ) ? [ 'ext' => 'svg', 'type' => 'image/svg+xml', 'proper_filename' => false ] : $d;
		}, 10, 3 );

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$filename = sanitize_file_name( $req['filename'] ?? '' );

		if ( ! empty( $req['data_base64'] ) ) {
			$bytes = base64_decode( (string) $req['data_base64'], true );
			if ( $bytes === false || $bytes === '' ) {
				return new WP_Error( 'f2b_invalid', 'data_base64 is not valid base64', [ 'status' => 400 ] );
			}
			if ( $filename === '' ) {
				return new WP_Error( 'f2b_invalid', 'filename is required with data_base64', [ 'status' => 400 ] );
			}
			$tmp = wp_tempnam( $filename );
			file_put_contents( $tmp, $bytes );
		} else {
			$url = (string) ( $req['url'] ?? '' );
			if ( ! preg_match( '#^https?://#i', $url ) ) {
				return new WP_Error( 'f2b_invalid', 'url must be http(s), or send data_base64', [ 'status' => 400 ] );
			}
			$tmp = download_url( $url, 60 );
			if ( is_wp_error( $tmp ) ) {
				return new WP_Error( 'f2b_download', $tmp->get_error_message(), [ 'status' => 502 ] );
			}
			$filename = $filename !== '' ? $filename : sanitize_file_name( basename( wp_parse_url( $url, PHP_URL_PATH ) ) );
		}

		$sha = hash_file( 'sha256', $tmp );

		$existing = get_posts( [
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'meta_key'       => '_f2b_sha256',
			'meta_value'     => $sha,
			'fields'         => 'ids',
		] );

		if ( $existing ) {
			@unlink( $tmp );
			$id = $existing[0];
		} else {
			$id = media_handle_sideload( [ 'name' => $filename, 'tmp_name' => $tmp ], 0, $req['title'] ?? null );
			if ( is_wp_error( $id ) ) {
				@unlink( $tmp );
				return new WP_Error( 'f2b_upload', $id->get_error_message(), [ 'status' => 422 ] );
			}
			update_post_meta( $id, '_f2b_sha256', $sha );
		}

		return [
			'id'       => $id,
			'url'      => wp_get_attachment_url( $id ),
			'filename' => basename( get_attached_file( $id ) ),
			'size'     => 'full',
			'sha256'   => $sha,
			'reused'   => (bool) $existing,
		];
	}

	/**
	 * Preview page for measuring a template at real width: a Bricks page whose only element is that template.
	 * ONE shared page (slug f2b-preview), rewritten for every template: the deliverable of a run is the templates plus one page with all of them
	 * in order (assemble_page), so the preview page is moved to the trash when the run ends (preview_cleanup).
	 */
	public static function preview( $req ) {
		$tpl = self::find( $req['id'] );
		if ( ! $tpl ) {
			return new WP_Error( 'f2b_not_found', 'template not found', [ 'status' => 404 ] );
		}

		$slug = 'f2b-preview';
		$page = get_page_by_path( $slug, OBJECT, 'page' );
		if ( $page && $page->post_status === 'trash' ) {
			wp_untrash_post( $page->ID );
		}
		$id = $page ? $page->ID : wp_insert_post( [
			'post_type'   => 'page',
			'post_status' => 'publish',
			'post_title'  => 'f2b preview',
			'post_name'   => $slug,
		] );
		if ( $page && $page->post_status !== 'publish' ) {
			wp_update_post( [ 'ID' => $id, 'post_status' => 'publish' ] );
		}

		update_post_meta( $id, BRICKS_DB_EDITOR_MODE, 'bricks' );
		update_post_meta( $id, BRICKS_DB_PAGE_CONTENT, [ [
			'id'       => 'f2bprv',
			'name'     => 'template',
			'parent'   => 0,
			'children' => [],
			'settings' => [ 'template' => $tpl->ID ],
		] ] );

		return [ 'pageId' => $id, 'url' => add_query_arg( 'page_id', $id, home_url( '/' ) ) ];
	}

	/** Move the preview page(s) to the trash: the shared one and the per-template ones older versions of the pipeline left (f2b-preview-<id>). */
	public static function preview_cleanup() {
		global $wpdb;
		$ids = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'page' AND post_status <> 'trash' AND ( post_name = 'f2b-preview' OR post_name LIKE 'f2b-preview-%' )" );
		foreach ( $ids as $id ) {
			wp_trash_post( (int) $id );
		}
		return [ 'trashed' => array_map( 'intval', $ids ) ];
	}

	/**
	 * The deliverable page: a Bricks page that holds the templates in the given order (body { key, title, template_ids: [..] }).
	 * Upserted by key, so a re-run updates the same page.
	 */
	public static function assemble_page( $req ) {
		$ids = array_values( array_filter( array_map( 'intval', (array) ( $req['template_ids'] ?? [] ) ) ) );
		$title = trim( (string) ( $req['title'] ?? '' ) );
		$key = sanitize_key( (string) ( $req['key'] ?? '' ) );
		if ( ! $ids || $title === '' || $key === '' ) {
			return new WP_Error( 'f2b_invalid', 'key, title and template_ids are required', [ 'status' => 400 ] );
		}
		$content = [];
		foreach ( $ids as $i => $tid ) {
			if ( ! self::find( $tid ) ) {
				return new WP_Error( 'f2b_not_found', "template $tid not found", [ 'status' => 404 ] );
			}
			$content[] = [
				'id'       => substr( md5( "f2b-page-$tid-$i" ), 0, 6 ),
				'name'     => 'template',
				'parent'   => 0,
				'children' => [],
				'settings' => [ 'template' => $tid ],
			];
		}
		$found = get_posts( [ 'post_type' => 'page', 'post_status' => [ 'publish', 'draft', 'private', 'trash' ], 'meta_key' => '_f2b_page_key', 'meta_value' => $key, 'numberposts' => 1 ] );
		$page = $found ? $found[0] : null;
		if ( $page && $page->post_status === 'trash' ) {
			wp_untrash_post( $page->ID );
		}
		$id = $page ? $page->ID : wp_insert_post( [ 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => $title ] );
		wp_update_post( [ 'ID' => $id, 'post_title' => $title, 'post_status' => 'publish' ] );
		update_post_meta( $id, '_f2b_page_key', $key );
		update_post_meta( $id, BRICKS_DB_EDITOR_MODE, 'bricks' );
		update_post_meta( $id, BRICKS_DB_PAGE_CONTENT, $content );

		return [ 'pageId' => $id, 'url' => get_permalink( $id ), 'builderUrl' => add_query_arg( 'bricks', 'run', get_permalink( $id ) ), 'templates' => $ids ];
	}

	/** Merge fonts: body { fonts: [ { family, weights: [400,700], italicWeights?: [400] } ] } */
	public static function set_fonts( $req ) {
		$in = $req['fonts'] ?? null;
		if ( ! is_array( $in ) ) {
			return new WP_Error( 'f2b_invalid', 'fonts must be an array of { family, weights }', [ 'status' => 400 ] );
		}

		$fonts = get_option( self::FONTS_OPTION, [] );
		foreach ( $in as $f ) {
			if ( empty( $f['family'] ) ) {
				continue;
			}
			$k = sanitize_text_field( $f['family'] );
			$fonts[ $k ]['w'] = array_values( array_unique( array_merge( $fonts[ $k ]['w'] ?? [], array_map( 'intval', $f['weights'] ?? [] ) ) ) );
			$fonts[ $k ]['i'] = array_values( array_unique( array_merge( $fonts[ $k ]['i'] ?? [], array_map( 'intval', $f['italicWeights'] ?? [] ) ) ) );
		}

		update_option( self::FONTS_OPTION, $fonts, false );
		return $fonts;
	}

	public static function list_elements() {
		$names = array_keys( \Bricks\Elements::$elements );
		sort( $names );
		return $names;
	}

	/** Controls (setting keys) of one element, scalar parts only (closures dropped) */
	public static function element_schema( $req ) {
		$name = $req['name'];
		if ( ! isset( \Bricks\Elements::$elements[ $name ] ) ) {
			return new WP_Error( 'f2b_not_found', 'unknown element', [ 'status' => 404 ] );
		}

		$el = \Bricks\Elements::get_element( [ 'name' => $name ] );

		$clean = function ( $v ) use ( &$clean ) {
			if ( is_array( $v ) ) {
				return array_map( $clean, $v );
			}
			return is_scalar( $v ) || $v === null ? $v : null;
		};

		return [
			'name'     => $name,
			'label'    => $el['label'] ?? $name,
			'category' => $el['category'] ?? null,
			'nestable' => ! empty( $el['nestable'] ),
			'controls' => $clean( $el['controls'] ?? [] ),
		];
	}
}

F2B_Bridge::init();
