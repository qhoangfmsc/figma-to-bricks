<?php
namespace Bricks\Integrations\Dynamic_Data;

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

/**
 * Class Dynamic_Data_Parser
 *
 * Parses arguments for dynamic data tags, including filters and key-value pairs.
 */
class Dynamic_Data_Parser {
	/**
	 * The input string to parse
	 *
	 * @var string
	 */
	private $input;

	/**
	 * List of allowed keys for arguments
	 *
	 * @var array
	 */
	private $allowed_keys;

	/**
	 * Constructor
	 */
	public function __construct() {
		$this->set_allowed_keys();
	}

	/**
	 * Parse the given input string
	 *
	 * @param string $input The input string to parse.
	 * @return array Associative array with 'tag', 'args', and 'original_tag'.
	 */
	public function parse( $input ) {
		$this->input = $input;
		return $this->parse_tag_and_args();
	}

	/**
	 * Parse the tag and its arguments
	 *
	 * @return array Associative array with 'tag', 'args', and 'original_tag'
	 */
	private function parse_tag_and_args() {
		// Generate regex pattern for allowed keys
		$allowed_keys_pattern = implode( '|', array_map( 'preg_quote', $this->allowed_keys ) );

		// Split the input at the first '@' followed by an allowed key
		$pattern = '/\s+(?=@(?:' . $allowed_keys_pattern . '):)/';
		$parts   = preg_split( $pattern, $this->input, 2 );

		// Parse the tag and filters
		$tag_and_filters = explode( ':', $parts[0] );
		$tag             = array_shift( $tag_and_filters );

		$args = [];

		// Add filters to args with numeric keys
		foreach ( $tag_and_filters as $index => $filter ) {
			$args[ $index ] = $filter;
		}

		// Parse key-value arguments if they exist
		if ( isset( $parts[1] ) ) {
			$kv_args = $this->parse_kv_args( $parts[1] );
			$args    = array_merge( $args, $kv_args );
		}

		return [
			'tag'          => $tag,
			'args'         => $args,
			'original_tag' => $this->input
		];
	}

	/**
	 * Parse the key-value arguments of the tag
	 *
	 * @param string $args_string The string containing all arguments.
	 * @return array Associative array of arguments
	 */
	private function parse_kv_args( $args_string ) {
		$args = [];
		preg_match_all( '/@(\w+(?:-\w+)*):(.+?)(?=\s+@|$)/s', $args_string, $matches, PREG_SET_ORDER );

		foreach ( $matches as $match ) {
			$key   = $match[1];
			$value = trim( $match[2] );

			// Remove surrounding quotes if present
			if ( preg_match( '/^([\'"])(.*)\1$/', $value, $quote_matches ) ) {
				$value = $quote_matches[2];
			}

			if ( in_array( $key, $this->allowed_keys, true ) ) {
				$args[ $key ] = $value;
			}
		}

		return $args;
	}

	/**
	 * Set the allowed keys for arguments
	 *
	 * Uses the 'bricks/dynamic_data/allowed_keys' filter to allow modification of the allowed keys.
	 *
	 * @since 1.11.1: Support 'sanitize' filter
	 */
	public function set_allowed_keys() {
		$default_keys = [ 'fallback', 'fallback-image', 'sanitize' ];

		// NOTE: Undocumented
		$this->allowed_keys = apply_filters( 'bricks/dynamic_data/allowed_keys', $default_keys );
	}
}
