<?php
namespace Bricks;

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

class Element_Icon extends Element {
	public $category = 'basic';
	public $name     = 'icon';
	public $icon     = 'ti-star';

	public function get_label() {
		return esc_html__( 'Icon', 'bricks' );
	}

	public function set_controls() {
		$this->controls['icon'] = [
			'label'   => esc_html__( 'Icon', 'bricks' ),
			'type'    => 'icon',
			'root'    => true, // To target 'svg' root
			'default' => [
				'library' => 'themify',
				'icon'    => 'ti-star',
			],
		];

		$this->controls['iconColor'] = [
			'label'    => esc_html__( 'Color', 'bricks' ),
			'type'     => 'color',
			'required' => [ 'icon.icon', '!=', '' ],
			'css'      => [
				[
					'property' => 'color',
				],
				[
					'property' => 'fill',
				],
			],
		];

		$this->controls['iconSize'] = [
			'label'    => esc_html__( 'Size', 'bricks' ),
			'type'     => 'number',
			'units'    => true,
			'required' => [ 'icon.icon', '!=', '' ],
			'css'      => [
				[
					'property' => 'font-size',
				],
			],
		];

		$this->controls['link'] = [
			'label' => esc_html__( 'Link', 'bricks' ),
			'type'  => 'link',
		];
	}

	public function render() {
		$settings = $this->settings;
		$icon     = $settings['icon'] ?? false;
		$link     = ! empty( $settings['link'] ) && bricks_is_frontend() ? $settings['link'] : false; // Front-end only (@since 1.10.2)

		if ( ! $icon ) {
			return $this->render_element_placeholder(
				[
					'title' => esc_html__( 'No icon selected.', 'bricks' ),
				]
			);
		}

		// Linked icon: Remove custom attributes from '_root' to add to the 'link'
		if ( $link ) {
			$custom_attributes = $this->get_custom_attributes( $settings );

			if ( is_array( $custom_attributes ) ) {
				foreach ( $custom_attributes as $key => $value ) {
					if ( isset( $this->attributes['_root'][ $key ] ) ) {
						unset( $this->attributes['_root'][ $key ] );
					}
				}
			}
		}

		// Support dynamic data color in loop
		if ( isset( $settings['iconColor']['raw'] ) && Query::is_looping() ) {
			if ( strpos( $settings['iconColor']['raw'], '{' ) !== false ) {
				$this->attributes['_root']['data-query-loop-index'] = Query::get_loop_index();
			}
		}

		// Run root attributes through filter (@since 1.10)
		if ( ! $link ) {
			$this->attributes = apply_filters( 'bricks/element/render_attributes', $this->attributes, '_root', $this );
		}

		$icon = self::render_icon( $icon, $this->attributes['_root'] );

		if ( $link ) {
			$this->set_link_attributes( 'link', $link );

			// Add custom attributes to the link instead of the icon
			echo "<a {$this->render_attributes( 'link', true )}>";
			echo $icon;
			echo '</a>';
		} else {
			echo $icon;
		}
	}
}
