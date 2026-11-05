<?php
namespace Bricks;

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

class Element_Map extends Element {
	public $category  = 'general';
	public $name      = 'map';
	public $icon      = 'ti-location-pin';
	public $scripts   = [ 'bricksMap' ];
	public $draggable = false;

	public function get_label() {
		return esc_html__( 'Map', 'bricks' );
	}

	public function enqueue_scripts() {
		wp_enqueue_script( 'bricks-google-maps' );
		wp_enqueue_script( 'bricks-google-maps-infobox' );
	}

	public function set_control_groups() {
		$this->control_groups['addresses'] = [
			'title'    => esc_html__( 'Addresses', 'bricks' ),
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->control_groups['markers'] = [
			'title'    => esc_html__( 'Markers', 'bricks' ),
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->control_groups['settings'] = [
			'title'    => esc_html__( 'Settings', 'bricks' ),
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];
	}

	public function set_controls() {
		$this->controls['infoNoApiKey'] = [
			'content'  => sprintf(
				// translators: %s: Link to settings page
				esc_html__( 'Enter your Google Maps API key under %s to access all options.', 'bricks' ),
				'<a href="' . Helpers::settings_url( '#tab-api-keys' ) . '" target="_blank">Bricks > ' . esc_html__( 'Settings', 'bricks' ) . ' > API keys</a>'
			),
			'type'     => 'info',
			'required' => [ 'apiKeyGoogleMaps', '=', '', 'globalSettings' ],
		];

		// No API key: Single address (@since 1.10.2)
		$this->controls['address'] = [
			'label'       => esc_html__( 'Address', 'bricks' ),
			'desc'        => esc_html__( 'To ensure showing a marker please provide the latitude and longitude, separated by comma.', 'bricks' ),
			'type'        => 'text',
			'placeholder' => 'Berlin, Germany',
			'required'    => [ 'apiKeyGoogleMaps', '=', '', 'globalSettings' ],
		];

		/**
		 * Group: ADDRESSES
		 */

		$this->controls['infoLatLong'] = [
			'group'    => 'addresses',
			'content'  => esc_html__( 'Please enter the latitude/longitude when using multiple markers.', 'bricks' ),
			'type'     => 'info',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['addresses'] = [
			'group'         => 'addresses',
			'placeholder'   => esc_html__( 'Addresses', 'bricks' ),
			'type'          => 'repeater',
			'titleProperty' => 'address',
			'fields'        => [
				'latitude'         => [
					'label'       => esc_html__( 'Latitude', 'bricks' ),
					'type'        => 'text',
					'trigger'     => [ 'blur', 'enter' ],
					'placeholder' => '52.5164154966524',
				],

				'longitude'        => [
					'label'       => esc_html__( 'Longitude', 'bricks' ),
					'type'        => 'text',
					'trigger'     => [ 'blur', 'enter' ],
					'placeholder' => '13.377643715349544',
				],

				'address'          => [
					'label'       => esc_html__( 'Address', 'bricks' ),
					'type'        => 'text',
					'trigger'     => [ 'blur', 'enter' ],
					'placeholder' => esc_html__( 'Berlin, Germany', 'bricks' ),
					'description' => esc_html__( 'Alternative to Latitude/Longitude fields', 'bricks' )
				],

				// Infobox: Toggle on marker click
				'infoboxSeparator' => [
					'label'       => esc_html__( 'Infobox', 'bricks' ),
					'type'        => 'separator',
					'description' => esc_html__( 'Infobox appears on map marker click.', 'bricks' ),
				],

				'infoTitle'        => [
					'label'   => esc_html__( 'Title', 'bricks' ),
					'type'    => 'text',
					'trigger' => [ 'blur', 'enter' ],
				],

				'infoSubtitle'     => [
					'label'   => esc_html__( 'Subtitle', 'bricks' ),
					'type'    => 'text',
					'trigger' => [ 'blur', 'enter' ],
				],

				'infoOpeningHours' => [
					'label'   => esc_html__( 'Content', 'bricks' ),
					'type'    => 'textarea',
					'trigger' => [ 'blur', 'enter' ],
				],

				'infoImages'       => [
					'label'    => esc_html__( 'Images', 'bricks' ),
					'type'     => 'image-gallery',
					'unsplash' => false,
				],

				'infoWidth'        => [
					'label'       => esc_html__( 'Width', 'bricks' ),
					'type'        => 'number',
					'inline'      => true,
					'placeholder' => '300',
				],
			],
			'default'       => [
				[
					'latitude'  => '52.5164154966524',
					'longitude' => '13.377643715349544'
				],
			],
			'required'      => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		/**
		 * Group: MARKERS
		 */

		$this->controls['marker'] = [
			'group'          => 'markers',
			'type'           => 'image',
			'hasDynamicData' => false,
			'unsplash'       => false,
			// translators: %s: Link to icons8.com
			'description'    => sprintf( '<a href="https://icons8.com/icon/set/map-marker/all" target="_blank">%s</a>', esc_html__( 'Get free marker icons from icons8.com', 'bricks' ) ),
			'required'       => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['markerHeight'] = [
			'group'    => 'markers',
			'label'    => esc_html__( 'Marker height in px', 'bricks' ),
			'type'     => 'number',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['markerWidth'] = [
			'group'    => 'markers',
			'label'    => esc_html__( 'Marker width in px', 'bricks' ),
			'type'     => 'number',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		// ACTIVE MARKER
		$this->controls['markerActiveSeparator'] = [
			'group'    => 'markers',
			'label'    => esc_html__( 'Active marker', 'bricks' ),
			'type'     => 'separator',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['markerActive'] = [
			'group'          => 'markers',
			'type'           => 'image',
			'hasDynamicData' => false,
			'unsplash'       => false,
			// translators: %s: Link to icons8.com
			'description'    => sprintf( '<a href="https://icons8.com/icon/set/map-marker/all" target="_blank">%s</a>', esc_html__( 'Get free marker icons from icons8.com', 'bricks' ) ),
			'required'       => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['markerActiveHeight'] = [
			'group'    => 'markers',
			'label'    => esc_html__( 'Active marker height in px', 'bricks' ),
			'type'     => 'number',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['markerActiveWidth'] = [
			'group'    => 'markers',
			'label'    => esc_html__( 'Active marker width in px', 'bricks' ),
			'type'     => 'number',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		/**
		 * Group: SETTINGS
		 */

		$this->controls['height'] = [
			'group'       => 'settings',
			'label'       => esc_html__( 'Height', 'bricks' ),
			'type'        => 'number',
			'units'       => true,
			'css'         => [
				[
					'property' => 'height',
				],
			],
			// 'required'    => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
			'placeholder' => '300px',
		];

		$this->controls['zoom'] = [
			'group'       => 'settings',
			'label'       => esc_html__( 'Zoom level', 'bricks' ),
			'type'        => 'number',
			'step'        => 1,
			'min'         => 0,
			'max'         => 20,
			'placeholder' => 12,
			// 'required'    => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['type'] = [
			'group'       => 'settings',
			'label'       => esc_html__( 'Map type', 'bricks' ),
			'type'        => 'select',
			'inline'      => true,
			'options'     => [
				'roadmap'   => esc_html__( 'Roadmap', 'bricks' ),
				'satellite' => esc_html__( 'Satellite', 'bricks' ),
				'hybrid'    => esc_html__( 'Hybrid', 'bricks' ),
				'terrain'   => esc_html__( 'Terrain', 'bricks' ),
			],
			'placeholder' => esc_html__( 'Roadmap', 'bricks' ),
			// 'required'    => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		// STEP: No API key controls
		if ( empty( Database::$global_settings['apiKeyGoogleMaps'] ) ) {
			unset( $this->controls['height']['group'] );
			unset( $this->controls['zoom']['group'] );
			unset( $this->controls['type']['group'] );
		}

		$map_styles                   = bricks_is_builder() ? Setup::get_map_styles() : [];
		$map_styles_options['custom'] = esc_html__( 'Custom', 'bricks' );

		foreach ( $map_styles as $key => $value ) {
			$map_styles_options[ $key ] = $value['label'];
		}

		// Requires map type: Roadmap
		$this->controls['style'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Map style', 'bricks' ),
			'type'     => 'select',
			'options'  => $map_styles_options,
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['customStyle'] = [
			'group'        => 'settings',
			'label'        => esc_html__( 'Custom map style', 'bricks' ),
			'type'         => 'code',
			'mode'         => 'json', // 'javascript', // Must be JSON for proper escaping (@since 1.11)
			'hasVariables' => false,
			// translators: %s: Link to snazzymaps.com
			'description'  => sprintf( esc_html__( 'Copy+paste code from one of the maps over at %s', 'bricks' ), '<a target="_blank" href="https://snazzymaps.com/explore">snazzymaps.com/explore</a>' ),
			'required'     => [ 'style', '=', 'custom' ],
		];

		// Needed to parse custom map style (@since 1.11)
		$this->controls['customStyleApply'] = [
			'group'    => 'settings',
			'type'     => 'apply',
			'reload'   => true,
			'required' => [
				[ 'style', '=', 'custom' ],
				[ 'customStyle', '!=', '' ],
			],
			'label'    => esc_html__( 'Apply', 'bricks' ) . ': ' . esc_html__( 'Custom map style', 'bricks' ),
		];

		$this->controls['scrollwheel'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Scroll', 'bricks' ),
			'type'     => 'checkbox',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
			'default'  => true,
		];

		$this->controls['draggable'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Draggable', 'bricks' ),
			'type'     => 'checkbox',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
			'default'  => true,
		];

		$this->controls['fullscreenControl'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Fullscreen Control', 'bricks' ),
			'type'     => 'checkbox',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['mapTypeControl'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Map Type Control', 'bricks' ),
			'type'     => 'checkbox',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['streetViewControl'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Street View Control', 'bricks' ),
			'type'     => 'checkbox',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
			'default'  => true,
		];

		$this->controls['disableDefaultUI'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Disable Default UI', 'bricks' ),
			'type'     => 'checkbox',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
		];

		$this->controls['zoomControl'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Zoom Control', 'bricks' ),
			'type'     => 'checkbox',
			'required' => [ 'apiKeyGoogleMaps', '!=', '', 'globalSettings' ],
			'default'  => true,
		];

		$this->controls['minZoom'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Zoom level', 'bricks' ) . ' (' . esc_html__( 'Min', 'bricks' ) . ')',
			'type'     => 'number',
			'step'     => 1,
			'min'      => 0,
			'required' => [ 'zoomControl', '!=', '' ],
		];

		$this->controls['maxZoom'] = [
			'group'    => 'settings',
			'label'    => esc_html__( 'Zoom level', 'bricks' ) . ' (' . esc_html__( 'Max', 'bricks' ) . ')',
			'type'     => 'number',
			'step'     => 1,
			'min'      => 0,
			'required' => [ 'zoomControl', '!=', '' ],
		];
	}

	public function render() {
		$settings = $this->settings;
		$map_type = $settings['type'] ?? 'roadmap';

		/**
		 * STEP: Use Google Maps Embed API
		 *
		 * No API key required, but limited functionality: Zoom level, map type //, fullscreen control, street view control, map type control, zoom control, disable default UI
		 *
		 * @since 1.10.2
		 */
		if ( empty( Database::$global_settings['apiKeyGoogleMaps'] ) ) {
			$address = isset( $settings['address'] ) ? $this->render_dynamic_data( $settings['address'] ) : 'Berlin, Germany';

			if ( $map_type === 'satellite' ) {
				$map_type = 'k'; // satellite
			} elseif ( $map_type === 'hybrid' ) {
				$map_type = 'h'; // hybrid
			} elseif ( $map_type === 'terrain' ) {
				$map_type = 'p'; // terrain
			} else {
				$map_type = 'm'; // roadmap
			}

			$zoom = isset( $settings['zoom'] ) ? intval( $settings['zoom'] ) : 12;

			$this->set_attribute( 'iframe', 'width', '100%' );
			$this->set_attribute( 'iframe', 'height', '100%' );
			$this->set_attribute( 'iframe', 'loading', 'lazy' );
			$this->set_attribute( 'iframe', 'src', 'https://maps.google.com/maps?q=' . urlencode( $address ) . '&t=' . $map_type . '&z=' . $zoom . '&output=embed&iwloc=near' );
			$this->set_attribute( 'iframe', 'allowfullscreen' );
			$this->set_attribute( 'iframe', 'title', esc_attr( $address ) ); // @since 1.12 (a11y)

			$this->set_attribute( '_root', 'class', 'no-key' );

			// Div needed in builder for DnD and click to edit
			echo "<div {$this->render_attributes( '_root' )}>";

			echo "<iframe {$this->render_attributes( 'iframe' )}></iframe>" . PHP_EOL;

			echo '</div>';

			return;
		}

		// Addresses, filter all the fields to render dynamic data before render
		$addresses = ! empty( $settings['addresses'] ) ? $settings['addresses'] : [ [ 'address' => 'Berlin, Germany' ] ];
		// InfoImages Gallery may use a custom field (handle it before)
		$gallery_class_name = isset( Elements::$elements['image-gallery']['class'] ) ? Elements::$elements['image-gallery']['class'] : false;

		if ( $gallery_class_name ) {
			$gallery = new $gallery_class_name();
			$gallery->set_post_id( $this->post_id );

			foreach ( $addresses as $index => $address ) {
				if ( empty( $address['infoImages'] ) ) {
					continue;
				}

				// Get infoImages data
				$info_images = $gallery->get_normalized_image_settings( [ 'items' => $address['infoImages'] ] );

				if ( empty( $info_images['items']['images'] ) ) {
					continue;
				}

				$addresses[ $index ]['infoImages'] = [];

				foreach ( $info_images['items']['images'] as $info_image ) {
					$image_id = $info_image['id'] ?? '';

					if ( ! $image_id ) {
						continue;
					}

					$image_size = $info_images['items']['size'] ?? 'thumbnail';
					$image_src  = wp_get_attachment_image_src( $image_id, $image_size );

					$addresses[ $index ]['infoImages'][] = [
						'src'       => $image_src[0],
						'width'     => $image_src[1],
						'height'    => $image_src[2],
						'thumbnail' => wp_get_attachment_image_url( $image_id, $image_size ),
					];
				}

				if ( isset( $addresses[ $index ]['infoImages']['useDynamicData'] ) ) {
					unset( $addresses[ $index ]['infoImages']['useDynamicData'] );
				}
			}
		}

		// Handle remaining text fields to replace dynamic data
		add_filter( 'bricks/acf/google_map/text_output', 'wp_strip_all_tags' );

		$addresses = map_deep( $addresses, [ $this, 'render_dynamic_data' ] );

		remove_filter( 'bricks/acf/google_map/text_output', 'wp_strip_all_tags' );

		$map_options = [
			'addresses'         => $addresses,
			'zoom'              => isset( $settings['zoom'] ) ? intval( $settings['zoom'] ) : 12,
			'scrollwheel'       => isset( $settings['scrollwheel'] ),
			'draggable'         => isset( $settings['draggable'] ),
			'fullscreenControl' => isset( $settings['fullscreenControl'] ),
			'mapTypeControl'    => isset( $settings['mapTypeControl'] ),
			'streetViewControl' => isset( $settings['streetViewControl'] ),
			'zoomControl'       => isset( $settings['zoomControl'] ),
			'disableDefaultUI'  => isset( $settings['disableDefaultUI'] ),
			'type'              => $map_type,
		];

		// Min zoom
		if ( isset( $settings['minZoom'] ) ) {
			$map_options['minZoom'] = intval( $settings['minZoom'] );
		}

		// Max zoom
		if ( isset( $settings['maxZoom'] ) ) {
			$map_options['maxZoom'] = intval( $settings['maxZoom'] );
		}

		// Custom marker
		if ( isset( $settings['marker']['url'] ) ) {
			$map_options['marker'] = $settings['marker']['url'];
		}

		if ( isset( $settings['markerHeight'] ) ) {
			$map_options['markerHeight'] = $settings['markerHeight'];
		}

		if ( isset( $settings['markerWidth'] ) ) {
			$map_options['markerWidth'] = $settings['markerWidth'];
		}

		// Custom active marker
		if ( isset( $settings['markerActive']['url'] ) ) {
			$map_options['markerActive'] = $settings['markerActive']['url'];
		}

		if ( isset( $settings['markerActiveHeight'] ) ) {
			$map_options['markerActiveHeight'] = $settings['markerActiveHeight'];
		}

		if ( isset( $settings['markerActiveWidth'] ) ) {
			$map_options['markerActiveWidth'] = $settings['markerActiveWidth'];
		}

		// Add pre-defined or custom map style
		$map_style = $settings['style'] ?? '';

		/**
		 * Set map style
		 *
		 * @since 1.9.3: Pass every map style as JSON string
		 */
		if ( $map_style ) {
			// Custom map style
			if ( $map_style === 'custom' ) {
				if ( ! empty( $settings['customStyle'] ) ) {
					$map_options['styles'] = wp_json_encode( $settings['customStyle'] );
				}
			}

			// Pre-defined map style
			else {
				$map_style             = Setup::get_map_styles( $map_style );
				$map_options['styles'] = $map_style;
			}
		}

		$this->set_attribute( '_root', 'data-bricks-map-options', wp_json_encode( $map_options ) );

		// No more inner .map as DnD only works in structure panel anyway (@since 1.5.4)
		echo "<div {$this->render_attributes( '_root' )}></div>";
	}
}
