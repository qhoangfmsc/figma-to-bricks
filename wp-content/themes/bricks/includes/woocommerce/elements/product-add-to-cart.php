<?php
namespace Bricks;

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

class Product_Add_To_Cart extends Element {
	public $category = 'woocommerce_product';
	public $name     = 'product-add-to-cart';
	public $icon     = 'ti-shopping-cart';

	public function enqueue_scripts() {
		// Ensure variation form in AJAX Popup can init (@since 1.10.2)
		wp_enqueue_script( 'wc-add-to-cart' );
		wp_enqueue_script( 'wc-add-to-cart-variation' );
	}

	public function get_label() {
		return esc_html__( 'Add to cart', 'bricks' );
	}

	public function set_control_groups() {
		$this->control_groups['variations'] = [
			'title' => esc_html__( 'Variations', 'bricks' ),
			'tab'   => 'content',
		];

		$this->control_groups['stock'] = [
			'title' => esc_html__( 'Stock', 'bricks' ),
			'tab'   => 'content',
		];

		$this->control_groups['form'] = [
			'title' => esc_html__( 'Form', 'bricks' ),
			'tab'   => 'content',
		];

		$this->control_groups['quantity'] = [
			'title' => esc_html__( 'Quantity', 'bricks' ),
			'tab'   => 'content',
		];

		$this->control_groups['button'] = [
			'title' => esc_html__( 'Button', 'bricks' ),
			'tab'   => 'content',
		];

		// @since 1.6.1
		if ( Woocommerce::enabled_ajax_add_to_cart() ) {
			$this->control_groups['ajax'] = [
				'title' => 'AJAX',
				'tab'   => 'content',
			];
		}
	}

	public function set_controls() {
		// VARIATIONS

		// NOTE: Variation settings not applicable in query loop (@since 1.6 @see #33v4yb9)

		$this->controls['variationsTypography'] = [
			'tab'   => 'content',
			'group' => 'variations',
			'label' => esc_html__( 'Typography', 'bricks' ),
			'type'  => 'typography',
			'css'   => [
				[
					'property' => 'font',
					'selector' => 'table.variations label',
				],
			],
		];

		$this->controls['variationsBackgroundColor'] = [
			'tab'   => 'content',
			'group' => 'variations',
			'label' => esc_html__( 'Background color', 'bricks' ),
			'type'  => 'color',
			'css'   => [
				[
					'property' => 'background-color',
					'selector' => 'table.variations tr',
				],
			],
		];

		$this->controls['variationsBorder'] = [
			'tab'   => 'content',
			'group' => 'variations',
			'label' => esc_html__( 'Border', 'bricks' ),
			'type'  => 'border',
			'css'   => [
				[
					'property' => 'border',
					'selector' => '.cart .variations tr:not(:has(.reset_variations))',
				]
			],
		];

		$this->controls['variationsMargin'] = [
			'tab'         => 'content',
			'group'       => 'variations',
			'label'       => esc_html__( 'Margin', 'bricks' ),
			'type'        => 'spacing',
			'css'         => [
				[
					'selector' => '.cart table.variations',
					'property' => 'margin',
				],
			],
			'placeholder' => [
				'bottom' => 30,
			],
		];

		$this->controls['variationsPadding'] = [
			'tab'         => 'content',
			'group'       => 'variations',
			'label'       => esc_html__( 'Padding', 'bricks' ),
			'type'        => 'spacing',
			'css'         => [
				[
					'selector' => '.cart table.variations td',
					'property' => 'padding',
				],
			],
			'placeholder' => [
				'top'    => 15,
				'bottom' => 15,
			],
		];

		$this->controls['variationsDescriptionTypography'] = [
			'tab'   => 'content',
			'group' => 'variations',
			'label' => esc_html__( 'Description typography', 'bricks' ),
			'type'  => 'typography',
			'css'   => [
				[
					'property' => 'font',
					'selector' => '.woocommerce-variation-description',
				],
			],
		];

		$this->controls['variationsPriceTypography'] = [
			'tab'   => 'content',
			'group' => 'variations',
			'label' => esc_html__( 'Price typography', 'bricks' ),
			'type'  => 'typography',
			'css'   => [
				[
					'property' => 'font',
					'selector' => '.woocommerce-variation-price',
				],
			],
		];

		$this->controls['variationsRegularPriceTypography'] = [
			'tab'   => 'content',
			'group' => 'variations',
			'label' => esc_html__( 'Regular price typography', 'bricks' ),
			'type'  => 'typography',
			'css'   => [
				[
					'selector' => '.woocommerce-variation-price .price del, .woocommerce-variation-price .price > span',
					'property' => 'font',
				],
			],
		];

		$this->controls['variationsSalePriceTypography'] = [
			'tab'   => 'content',
			'group' => 'variations',
			'label' => esc_html__( 'Sale price typography', 'bricks' ),
			'type'  => 'typography',
			'css'   => [
				[
					'selector' => '.woocommerce-variation-price .price ins',
					'property' => 'font',
				],
			],
		];

		// STOCK

		// NOTE: Stock settings not applicable in query loop (@since 1.6 @see #33v4yb9)

		$this->controls['hideStock'] = [
			'tab'   => 'content',
			'group' => 'stock',
			'label' => esc_html__( 'Hide stock', 'bricks' ),
			'type'  => 'checkbox',
			'css'   => [
				[
					'selector' => '.stock',
					'property' => 'display',
					'value'    => 'none',
				],
			],
		];

		$this->controls['stockTypography'] = [
			'tab'      => 'content',
			'group'    => 'stock',
			'label'    => esc_html__( 'Typography', 'bricks' ),
			'type'     => 'typography',
			'css'      => [
				[
					'property' => 'font',
					'selector' => '.stock',
				],
			],
			'required' => [ 'hideStock', '=', '' ]
		];

		// FORM (@since 1.12.2)
		$this->controls['formInfo'] = [
			'tab'     => 'content',
			'group'   => 'form',
			'type'    => 'info',
			'content' => esc_html__( 'Only applicable if the add to cart display as form (e.g. on single product page).', 'bricks' ),
		];

		$this->controls['formDisplay'] = [
			'tab'       => 'content',
			'group'     => 'form',
			'type'      => 'select',
			'label'     => esc_html__( 'Display', 'bricks' ),
			'type'      => 'select',
			'options'   => [
				'flex'         => 'flex',
				'inline-flex'  => 'inline-flex',
				'block'        => 'block',
				'inline-block' => 'inline-block',
				'inline'       => 'inline',
				'none'         => 'none',
			],
			'add'       => true,
			'inline'    => true,
			'lowercase' => true,
			'css'       => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'display',
				],
			],
		];

		$this->controls['formFlexDirection'] = [
			'tab'      => 'content',
			'group'    => 'form',
			'label'    => esc_html__( 'Direction', 'bricks' ),
			'tooltip'  => [
				'content'  => 'flex-direction',
				'position' => 'top-left',
			],
			'type'     => 'direction',
			'css'      => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'flex-direction',
				],
			],
			'inline'   => true,
			'rerender' => true,
			'required' => [ 'formDisplay', '=', 'flex' ],
		];

		$this->controls['formAlignSelf'] = [
			'tab'     => 'content',
			'group'   => 'form',
			'label'   => esc_html__( 'Align self', 'bricks' ),
			'type'    => 'align-items',
			'tooltip' => [
				'content'  => 'align-self',
				'position' => 'top-left',
			],
			'css'     => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'align-self',
				],
			],
		];

		$this->controls['formJustifyContent'] = [
			'tab'      => 'content',
			'group'    => 'form',
			'label'    => esc_html__( 'Align main axis', 'bricks' ),
			'tooltip'  => [
				'content'  => 'justify-content',
				'position' => 'top-left',
			],
			'type'     => 'justify-content',
			'css'      => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'justify-content',
				],
			],
			'required' => [ 'formDisplay', '=', [ 'flex', 'inline-flex' ] ],
		];

		$this->controls['formAlignItems'] = [
			'tab'      => 'content',
			'group'    => 'form',
			'label'    => esc_html__( 'Align cross axis', 'bricks' ),
			'tooltip'  => [
				'content'  => 'align-items',
				'position' => 'top-left',
			],
			'type'     => 'align-items',
			'css'      => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'align-items',
				],
			],
			'required' => [ 'formDisplay', '=', [ 'flex', 'inline-flex' ] ],
		];

		$this->controls['formGap'] = [
			'tab'      => 'content',
			'group'    => 'form',
			'label'    => esc_html__( 'Gap', 'bricks' ),
			'type'     => 'number',
			'units'    => true,
			'css'      => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'gap',
				],
			],
			'required' => [ 'formDisplay', '=', [ 'flex', 'inline-flex' ] ],
		];

		$this->controls['formFlexGrow'] = [
			'tab'         => 'content',
			'group'       => 'form',
			'label'       => esc_html__( 'Flex grow', 'bricks' ),
			'type'        => 'number',
			'tooltip'     => [
				'content'  => 'flex-grow',
				'position' => 'top-left',
			],
			'css'         => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'flex-grow',
				],
			],
			'min'         => 0,
			'placeholder' => 0,
		];

		$this->controls['formFlexShrink'] = [
			'tab'         => 'content',
			'group'       => 'form',
			'label'       => esc_html__( 'Flex shrink', 'bricks' ),
			'type'        => 'number',
			'tooltip'     => [
				'content'  => 'flex-shrink',
				'position' => 'top-left',
			],
			'css'         => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'flex-shrink',
				],
			],
			'min'         => 0,
			'placeholder' => 1,
		];

		$this->controls['formFlexBasis'] = [
			'tab'            => 'content',
			'group'          => 'form',
			'label'          => esc_html__( 'Flex basis', 'bricks' ),
			'type'           => 'text',
			'tooltip'        => [
				'content'  => 'flex-basis',
				'position' => 'top-left',
			],
			'css'            => [
				[
					'selector' => 'form.cart:not(.variations_form), form.cart.variations_form .woocommerce-variation-add-to-cart',
					'property' => 'flex-basis',
				],
			],
			'inline'         => true,
			'hasDynamicData' => false,
			'hasVariables'   => true,
			'placeholder'    => 'auto',
		];

		// QUANTITY

		// NOTE: Variation settings not applicable in query loop (@since 1.6 @see #33v4yb9)

		$this->controls['quantityWidth'] = [
			'tab'   => 'content',
			'group' => 'quantity',
			'type'  => 'number',
			'units' => true,
			'label' => esc_html__( 'Width', 'bricks' ),
			'css'   => [
				[
					'selector' => '.cart .quantity',
					'property' => 'width',
				],
			],
		];

		$this->controls['quantityBackground'] = [
			'tab'   => 'content',
			'group' => 'quantity',
			'type'  => 'color',
			'label' => esc_html__( 'Background', 'bricks' ),
			'css'   => [
				[
					'selector' => '.cart .quantity',
					'property' => 'background-color',
				],
			],
		];

		$this->controls['quantityBorder'] = [
			'tab'   => 'content',
			'group' => 'quantity',
			'type'  => 'border',
			'label' => esc_html__( 'Border', 'bricks' ),
			'css'   => [
				[
					'selector' => '.qty',
					'property' => 'border',
				],
				[
					'selector' => '.minus',
					'property' => 'border',
				],
				[
					'selector' => '.plus',
					'property' => 'border',
				],
			],
		];

		// BUTTON

		$this->controls['buttonText'] = [
			'tab'         => 'content',
			'group'       => 'button',
			'type'        => 'text',
			'inline'      => true,
			'label'       => esc_html__( 'Simple product', 'bricks' ),
			'placeholder' => esc_html__( 'Add to cart', 'bricks' ),
		];

		$this->controls['variableText'] = [
			'tab'         => 'content',
			'group'       => 'button',
			'type'        => 'text',
			'inline'      => true,
			'label'       => esc_html__( 'Variable product', 'bricks' ),
			'placeholder' => esc_html__( 'Select options', 'bricks' ),
		];

		$this->controls['groupedText'] = [
			'tab'         => 'content',
			'group'       => 'button',
			'type'        => 'text',
			'inline'      => true,
			'label'       => esc_html__( 'Grouped product', 'bricks' ),
			'placeholder' => esc_html__( 'View products', 'bricks' ),
		];

		$this->controls['externalText'] = [
			'tab'         => 'content',
			'group'       => 'button',
			'type'        => 'text',
			'inline'      => true,
			'label'       => esc_html__( 'External product', 'bricks' ),
			'placeholder' => esc_html__( 'Buy product', 'bricks' ),
		];

		$this->controls['buttonMargin'] = [
			'tab'   => 'content',
			'group' => 'button',
			'label' => esc_html__( 'Margin', 'bricks' ),
			'type'  => 'spacing',
			'css'   => [
				[
					'selector' => '.cart .single_add_to_cart_button, a.button[data-product_id]',
					'property' => 'margin',
				],
			],
		];

		$this->controls['buttonPadding'] = [
			'tab'   => 'content',
			'group' => 'button',
			'label' => esc_html__( 'Padding', 'bricks' ),
			'type'  => 'spacing',
			'css'   => [
				[
					'selector' => '.cart .single_add_to_cart_button, a.button[data-product_id]',
					'property' => 'padding',
				],
			],
		];

		$this->controls['buttonWidth'] = [
			'tab'   => 'content',
			'group' => 'button',
			'label' => esc_html__( 'Width', 'bricks' ),
			'type'  => 'number',
			'units' => true,
			'css'   => [
				[
					'selector' => '.cart .single_add_to_cart_button, a.button[data-product_id]',
					'property' => 'min-width',
				],
			],
		];

		$this->controls['buttonBackgroundColor'] = [
			'tab'   => 'content',
			'group' => 'button',
			'label' => esc_html__( 'Background color', 'bricks' ),
			'type'  => 'color',
			'css'   => [
				[
					'selector' => '.cart .single_add_to_cart_button, a.button[data-product_id]',
					'property' => 'background-color',
				],
			],
		];

		$this->controls['buttonBorder'] = [
			'tab'   => 'content',
			'group' => 'button',
			'label' => esc_html__( 'Border', 'bricks' ),
			'type'  => 'border',
			'css'   => [
				[
					'property' => 'border',
					'selector' => '.cart .single_add_to_cart_button, a.button[data-product_id]',
				],
			],
		];

		$this->controls['buttonTypography'] = [
			'tab'   => 'content',
			'group' => 'button',
			'label' => esc_html__( 'Typography', 'bricks' ),
			'type'  => 'typography',
			'css'   => [
				[
					'selector' => '.cart .single_add_to_cart_button, a.button[data-product_id]',
					'property' => 'font',
				],
			],
		];

		// Button icon

		$this->controls['icon'] = [
			'tab'      => 'content',
			'group'    => 'button',
			'label'    => esc_html__( 'Icon', 'bricks' ),
			'type'     => 'icon',
			'rerender' => true,
		];

		$this->controls['iconTypography'] = [
			'tab'   => 'content',
			'group' => 'button',
			'label' => esc_html__( 'Icon typography', 'bricks' ),
			'type'  => 'typography',
			'css'   => [
				[
					'property' => 'font',
					'selector' => '.icon',
				],
			],
		];

		$this->controls['iconOnly'] = [
			'tab'         => 'content',
			'group'       => 'button',
			'label'       => esc_html__( 'Icon only', 'bricks' ),
			'type'        => 'checkbox',
			'inline'      => true,
			'placeholder' => esc_html__( 'Yes', 'bricks' ),
			'required'    => [ 'icon', '!=', '' ],
		];

		$this->controls['iconPosition'] = [
			'tab'         => 'content',
			'group'       => 'button',
			'label'       => esc_html__( 'Icon position', 'bricks' ),
			'type'        => 'select',
			'options'     => $this->control_options['iconPosition'],
			'inline'      => true,
			'placeholder' => esc_html__( 'Left', 'bricks' ),
			'required'    => [
				[ 'icon', '!=', '' ],
				[ 'iconOnly', '=', '' ],
			],
		];

		// AJAX add to cart
		if ( Woocommerce::enabled_ajax_add_to_cart() ) {
			$this->controls['ajaxIfno'] = [
				'tab'     => 'content',
				'group'   => 'ajax',
				'type'    => 'info',
				'content' => sprintf(
					// translators: %s is a link to the global AJAX add to cart settings
					esc_html__( 'Set globally under %s', 'bricks' ),
					'<a href="' . Helpers::settings_url( '#tab-woocommerce' ) . '" target="_blank">Bricks > ' . esc_html__( 'Settings', 'bricks' ) . ' > WooCommerce > ' . esc_html__( 'AJAX add to cart', 'bricks' ) . '</a>.',
				),
			];

			$this->controls['addingSeparator'] = [
				'tab'   => 'content',
				'group' => 'ajax',
				'label' => esc_html__( 'Adding', 'bricks' ),
				'type'  => 'separator',
			];

			$this->controls['addingButtonText'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'type'        => 'text',
				'label'       => esc_html__( 'Button text', 'bricks' ),
				'inline'      => true,
				'placeholder' => Database::$global_settings['woocommerceAjaxAddingText'] ?? esc_html__( 'Adding', 'bricks' ),
			];

			$this->controls['addingButtonIcon'] = [
				'tab'      => 'content',
				'group'    => 'ajax',
				'label'    => esc_html__( 'Icon', 'bricks' ),
				'type'     => 'icon',
				'rerender' => true,
			];

			$this->controls['addingButtonIconOnly'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'label'       => esc_html__( 'Icon only', 'bricks' ),
				'type'        => 'checkbox',
				'inline'      => true,
				'placeholder' => esc_html__( 'Yes', 'bricks' ),
				'required'    => [ 'addingButtonIcon', '!=', '' ],
			];

			$this->controls['addingButtonIconPosition'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'label'       => esc_html__( 'Icon position', 'bricks' ),
				'type'        => 'select',
				'options'     => $this->control_options['iconPosition'],
				'inline'      => true,
				'placeholder' => esc_html__( 'Left', 'bricks' ),
				'required'    => [
					[ 'addingButtonIcon', '!=', '' ],
					[ 'addingButtonIconOnly', '=', '' ]
				],
			];

			$this->controls['addingButtonIconSpinning'] = [
				'tab'      => 'content',
				'group'    => 'ajax',
				'label'    => esc_html__( 'Icon spinning', 'bricks' ),
				'type'     => 'checkbox',
				'required' => [ 'addingButtonIcon', '!=', '' ],
			];

			// Added

			$this->controls['addedSeparator'] = [
				'tab'   => 'content',
				'group' => 'ajax',
				'label' => esc_html__( 'Added', 'bricks' ),
				'type'  => 'separator',
			];

			$this->controls['addedButtonText'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'type'        => 'text',
				'label'       => esc_html__( 'Button text', 'bricks' ),
				'inline'      => true,
				'placeholder' => Database::$global_settings['woocommerceAjaxAddedText'] ?? esc_html__( 'Added', 'bricks' ),
			];

			$this->controls['resetTextAfter'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'type'        => 'number',
				'label'       => esc_html__( 'Reset text after .. seconds', 'bricks' ),
				'inline'      => true,
				'placeholder' => 3,
			];

			$this->controls['addedButtonIcon'] = [
				'tab'      => 'content',
				'group'    => 'ajax',
				'label'    => esc_html__( 'Icon', 'bricks' ),
				'type'     => 'icon',
				'rerender' => true,
			];

			$this->controls['addedButtonIconOnly'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'label'       => esc_html__( 'Icon only', 'bricks' ),
				'type'        => 'checkbox',
				'inline'      => true,
				'placeholder' => esc_html__( 'Yes', 'bricks' ),
				'required'    => [ 'addedButtonIcon', '!=', '' ],
			];

			$this->controls['addedButtonIconPosition'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'label'       => esc_html__( 'Icon position', 'bricks' ),
				'type'        => 'select',
				'options'     => $this->control_options['iconPosition'],
				'inline'      => true,
				'placeholder' => esc_html__( 'Left', 'bricks' ),
				'required'    => [
					[ 'addedButtonIcon', '!=', '' ],
					[ 'addedButtonIconOnly', '=', '' ],
				],
			];

			// Show notice after added (@since 1.9)
			$this->controls['showNotice'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'label'       => esc_html__( 'Show notice', 'bricks' ),
				'type'        => 'select',
				'inline'      => true,
				'placeholder' => isset( Database::$global_settings['woocommerceAjaxShowNotice'] ) ? esc_html__( 'Yes', 'bricks' ) : esc_html__( 'No', 'bricks' ),
				'options'     => [
					'no'  => esc_html__( 'No', 'bricks' ),
					'yes' => esc_html__( 'Yes', 'bricks' ),
				],
			];

			// Scroll to notice after added (@since 1.9)
			$this->controls['scrollToNotice'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'label'       => esc_html__( 'Scroll to notice', 'bricks' ),
				'type'        => 'select',
				'inline'      => true,
				'placeholder' => isset( Database::$global_settings['woocommerceAjaxScrollToNotice'] ) ? esc_html__( 'Yes', 'bricks' ) : esc_html__( 'No', 'bricks' ),
				'options'     => [
					'no'  => esc_html__( 'No', 'bricks' ),
					'yes' => esc_html__( 'Yes', 'bricks' ),
				],
				'required'    => [ 'showNotice', '=', 'yes' ],
			];

			// Hide "View cart" button after added (@since 1.9)
			$this->controls['hideViewCart'] = [
				'tab'         => 'content',
				'group'       => 'ajax',
				'label'       => esc_html__( 'Hide "View cart" button', 'bricks' ),
				'type'        => 'select',
				'inline'      => true,
				'placeholder' => isset( Database::$global_settings['woocommerceAjaxHideViewCart'] ) ? esc_html__( 'Yes', 'bricks' ) : esc_html__( 'No', 'bricks' ),
				'options'     => [
					'inline-flex' => esc_html__( 'No', 'bricks' ), // Default .add_to_cart button display is inline-flex
					'none'        => esc_html__( 'Yes', 'bricks' ),
				],
				'css'         => [
					[
						'selector' => '.added_to_cart.wc-forward',
						'property' => 'display',
					],
				],
			];
		}
	}

	public function render() {
		$settings = $this->settings;

		global $product;

		$product = wc_get_product( $this->post_id );

		if ( empty( $product ) ) {
			return $this->render_element_placeholder(
				[
					'title'       => esc_html__( 'For better preview select content to show.', 'bricks' ),
					'description' => esc_html__( 'Go to: Settings > Template Settings > Populate Content', 'bricks' ),
				]
			);
		}

		// Return: Product is out of stock and "Hide stock" is enabled (@since 1.12)
		if ( isset( $settings['hideStock'] ) && ! $product->is_in_stock() ) {
			return $this->render_element_placeholder(
				[
					'title'       => esc_html__( 'Product is out of stock.', 'bricks' ),
					'description' => esc_html__( 'Go to: WooCommerce > Products > Inventory', 'bricks' ),
				]
			);
		}

		$this->maybe_set_ajax_add_to_cart_data_attribute();

		add_filter( 'woocommerce_product_single_add_to_cart_text', [ $this, 'add_to_cart_text' ], 10, 2 );
		add_filter( 'woocommerce_product_add_to_cart_text', [ $this, 'add_to_cart_text' ], 10, 2 );
		add_filter( 'esc_html', [ $this, 'avoid_esc_html' ], 10, 2 );

		echo "<div {$this->render_attributes( '_root' )}>";

		// In AJAX Popup, is_looping() is always true, but we want to show the single add to cart button (@since 1.10.2)
		$is_single_product_in_ajax_popup = Api::is_current_endpoint( 'load_popup_content' ) && (int) get_queried_object_id() === (int) $this->post_id;

		if ( Query::is_looping() && ! $is_single_product_in_ajax_popup ) {
			woocommerce_template_loop_add_to_cart();
		} else {
			woocommerce_template_single_add_to_cart();
		}

		echo '</div>';

		remove_filter( 'woocommerce_product_single_add_to_cart_text', [ $this, 'add_to_cart_text' ], 10, 2 );
		remove_filter( 'woocommerce_product_add_to_cart_text', [ $this, 'add_to_cart_text' ], 10, 2 );
		remove_filter( 'esc_html', [ $this, 'avoid_esc_html' ], 10, 2 );
	}

	/**
	 * Add custom text and/or icon to the button
	 *
	 * @param string     $text
	 * @param WC_Product $product
	 *
	 * @since 1.6
	 */
	public function add_to_cart_text( $text, $product ) {
		$settings = $this->settings;

		// Support changing the text based on product type (simple, variable, grouped, external) (@since 1.9)
		// NOTE TODO: Sometime product not purchasable has different text... worth to add more text fields?
		switch ( $product->get_type() ) {
			case 'variable':
				$text = ! empty( $settings['variableText'] ) ? $settings['variableText'] : $text;
				break;
			case 'grouped':
				$text = ! empty( $settings['groupedText'] ) ? $settings['groupedText'] : $text;
				break;
			case 'external':
				$text = ! empty( $settings['externalText'] ) ? $settings['externalText'] : $text;
				break;
			case 'simple':
				$text = ! empty( $settings['buttonText'] ) ? $settings['buttonText'] : $text;
				break;
		}

		$icon          = ! empty( $settings['icon'] ) ? self::render_icon( $settings['icon'], [ 'icon' ] ) : false;
		$icon_position = isset( $settings['iconPosition'] ) ? $settings['iconPosition'] : 'left';
		$icon_only     = isset( $settings['iconOnly'] );

		// Build HTML
		$output = '';

		if ( $icon_only && $icon ) {
			// Icon only (@since 1.12.2)
			$output = $icon;
		} else {
			if ( $icon && $icon_position === 'left' ) {
				$output .= $icon;
			}

			$output .= "<span>$text</span>";

			if ( $icon && $icon_position === 'right' ) {
				$output .= $icon;
			}
		}

		return $output;
	}

	/**
	 * TODO: Needs description
	 *
	 * @since 1.6
	 */
	public function avoid_esc_html( $safe_text, $text ) {
		return $text;
	}

	/**
	 * Set AJAX add to cart data attribute: data-bricks-ajax-add-to-cart
	 *
	 * @since 1.6.1
	 */
	public function maybe_set_ajax_add_to_cart_data_attribute() {
		// Set data attribute if ajax add to cart is enabled
		if ( ! Woocommerce::enabled_ajax_add_to_cart() ) {
			return;
		}

		$settings = $this->settings;

		$default_icon          = isset( $settings['icon'] ) ? self::render_icon( $settings['icon'], [ 'icon' ] ) : false;
		$default_icon_position = isset( $settings['iconPosition'] ) ? $settings['iconPosition'] : 'left';

		$states = [ 'adding', 'added' ];

		$ajax_add_to_cart_data = [];

		foreach ( $states as $state ) {
			$default_add_to_cart_text = $state === 'adding' ? WooCommerce::global_ajax_adding_text() : WooCommerce::global_ajax_added_text();
			$state_text               = isset( $settings[ $state . 'ButtonText' ] ) ? $settings[ $state . 'ButtonText' ] : $default_add_to_cart_text;
			$icon_classes             = isset( $settings[ $state . 'ButtonIconSpinning' ] ) ? [ 'icon', 'spinning' ] : [ 'icon' ];
			$icon                     = isset( $settings[ $state . 'ButtonIcon' ] ) ? self::render_icon( $settings[ $state . 'ButtonIcon' ], $icon_classes ) : $default_icon;
			$icon_position            = isset( $settings[ $state . 'ButtonIconPosition' ] ) ? $settings[ $state . 'ButtonIconPosition' ] : $default_icon_position;
			$icon_only                = isset( $settings[ $state . 'ButtonIconOnly' ] );

			// Build HTML
			$output = '';

			if ( $icon_only && $icon ) {
				// Icon only (@since 1.12.2)
				$output = $icon;
			} else {
				if ( $icon && $icon_position === 'left' ) {
					$output .= $icon;
				}

				$output .= "<span>$state_text</span>";

				if ( $icon && $icon_position === 'right' ) {
					$output .= $icon;
				}
			}

			$ajax_add_to_cart_data[ $state . 'HTML' ] = $output;
		}

		$show_notice      = Woocommerce::global_ajax_show_notice();
		$scroll_to_notice = Woocommerce::global_ajax_scroll_to_notice();
		$reset_after      = Woocommerce::global_ajax_reset_text_after();

		if ( isset( $settings['showNotice'] ) ) {
			// Override global setting if set
			$show_notice = $settings['showNotice'];
		}

		if ( isset( $settings['scrollToNotice'] ) ) {
			// Override global setting if set
			$scroll_to_notice = $settings['scrollToNotice'];
		}

		if ( isset( $settings['resetTextAfter'] ) ) {
			// Override global setting if set
			$reset_after = absint( $settings['resetTextAfter'] );
		}

		$ajax_add_to_cart_data['showNotice']     = $show_notice;
		$ajax_add_to_cart_data['scrollToNotice'] = $scroll_to_notice;
		$ajax_add_to_cart_data['resetTextAfter'] = max( $reset_after, 1 );

		$this->set_attribute( '_root', 'data-bricks-ajax-add-to-cart', wp_json_encode( $ajax_add_to_cart_data ) );
	}
}
