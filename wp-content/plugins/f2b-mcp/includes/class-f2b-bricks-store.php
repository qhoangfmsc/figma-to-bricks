<?php
/**
 * One store for local and staging.
 *
 * The builder writes pageSettings to _bricks_page_settings and templateSettings to
 * _bricks_template_settings (includes/ajax.php). Header, popup, conditions, password
 * protection and preview controls all live on template settings (settings-template.php,
 * popups.php). A key left in page settings is invisible to the builder and to the
 * frontend that reads Helpers::get_template_settings. Both writers call this class so
 * a template saved locally is the same meta the staging builder reads.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class F2B_Bricks_Store {
	public static function template_setting_keys() {
		return array(
			'headerPosition',
			'headerWidth',
			'headerAbsolute',
			'headerSticky',
			'headerStickyOnScroll',
			'headerStickySlideUpAfter',
			'headerStickyScrollingColor',
			'headerStickyScrollingBackground',
			'headerStickyScrollingBoxShadow',
			'headerStickyTransition',
			'template_interactions',
			'templateConditions',
			'passwordProtectionSource',
			'passwordProtectionError',
			'passwordProtectionPassword',
			'passwordProtectionExcludeHeader',
			'passwordProtectionExcludeFooter',
			'passwordProtectionExcludePopups',
			'passwordProtectionBypassLoggedIn',
			'passwordProtectionSchedule',
			'passwordProtectionStartDate',
			'passwordProtectionEndDate',
			'templatePreviewType',
			'templatePreviewAuthor',
			'templatePreviewPostType',
			'templatePreviewTerm',
			'templatePreviewSearchTerm',
			'templatePreviewPostId',
			'popupPadding',
			'popupJustifyConent',
			'popupAlignItems',
			'popupCloseOn',
			'popupZindex',
			'popupBodyScroll',
			'popupScrollToTop',
			'popupDisableAutoFocus',
			'popupAjax',
			'popupIsWoo',
			'popupAjaxLoaderAnimation',
			'popupAjaxLoaderColor',
			'popupAjaxLoaderScale',
			'popupAjaxLoaderSelector',
			'popupBreakpointMode',
			'popupShowAt',
			'popupShowOn',
			'popupDisableBackdrop',
			'popupBackground',
			'popupBackdropTransition',
			'popupContentPadding',
			'popupContentWidth',
			'popupContentHeight',
			'popupContentBackground',
			'popupContentBorder',
			'popupContentBoxShadow',
			'popupLimitWindow',
			'popupLimitSessionStorage',
			'popupLimitLocalStorage',
			'popupLimitTimeStorage',
		);
	}

	public static function script_keys() {
		return array( 'customScriptsHeader', 'customScriptsBodyHeader', 'customScriptsBodyFooter' );
	}

	// Bricks echoes these fields as HTML. Bare JavaScript is painted as text.
	public static function script_element( $value ) {
		if ( ! is_string( $value ) ) {
			return $value;
		}
		$trim = trim( $value );
		if ( '' === $trim || preg_match( '/^<script\b/i', $trim ) ) {
			return $value;
		}
		return '<script>' . $trim . '</script>';
	}

	/**
	 * Merge incoming settings into the two metas the builder uses.
	 * A template key already sitting in page settings is moved across.
	 *
	 * @return array{page:array,template:array}
	 */
	public static function split_settings( $page, $template, array $incoming ) {
		if ( ! is_array( $page ) ) {
			$page = array();
		}
		if ( ! is_array( $template ) ) {
			$template = array();
		}
		$template_keys = array_flip( self::template_setting_keys() );
		$script_keys   = array_flip( self::script_keys() );
		foreach ( $incoming as $key => $value ) {
			if ( isset( $script_keys[ $key ] ) ) {
				$value = self::script_element( $value );
			}
			if ( isset( $template_keys[ $key ] ) ) {
				$template[ $key ] = $value;
				unset( $page[ $key ] );
				continue;
			}
			$page[ $key ] = $value;
		}
		foreach ( self::template_setting_keys() as $key ) {
			if ( array_key_exists( $key, $page ) && ! array_key_exists( $key, $incoming ) ) {
				$template[ $key ] = $page[ $key ];
				unset( $page[ $key ] );
			}
		}
		foreach ( self::script_keys() as $key ) {
			if ( isset( $page[ $key ] ) ) {
				$page[ $key ] = self::script_element( $page[ $key ] );
			}
		}
		return array(
			'page'     => $page,
			'template' => $template,
		);
	}

	public static function link_children( $elements ) {
		foreach ( $elements as $index => $element ) {
			$elements[ $index ]['children'] = array();
			if ( ! isset( $element['parent'] ) || '' === $element['parent'] || null === $element['parent'] ) {
				$elements[ $index ]['parent'] = 0;
			}
		}
		$index_of = array();
		foreach ( $elements as $index => $element ) {
			$index_of[ (string) $element['id'] ] = $index;
		}
		foreach ( $elements as $element ) {
			$parent = $elements[ $index_of[ (string) $element['id'] ] ]['parent'];
			if ( 0 === $parent || '0' === $parent || '' === $parent || null === $parent ) {
				continue;
			}
			$elements[ $index_of[ (string) $parent ] ]['children'][] = $element['id'];
		}
		return $elements;
	}
}
