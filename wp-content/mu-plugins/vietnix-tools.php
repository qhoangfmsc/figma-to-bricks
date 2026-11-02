<?php
/**
 * Plugin Name: Vietnix Tools
 * Description: One admin screen to paste Figma frames and generate a Bricks template. The page is not assembled; the user inserts the template.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function () {
	add_menu_page(
		'Vietnix Tools',
		'Vietnix Tools',
		'manage_options',
		'vietnix-tools',
		'vietnix_tools_screen',
		'dashicons-layout',
		3
	);
} );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
	if ( $hook !== 'toplevel_page_vietnix-tools' ) {
		return;
	}
	$dir = __DIR__ . '/vietnix-tools';
	wp_enqueue_style( 'vietnix-tools', content_url( 'mu-plugins/vietnix-tools/app.css' ), [], filemtime( $dir . '/app.css' ) );
	wp_enqueue_script( 'vietnix-tools', content_url( 'mu-plugins/vietnix-tools/app.js' ), [], filemtime( $dir . '/app.js' ), true );
	$token = is_readable( $dir . '/.token' ) ? trim( (string) file_get_contents( $dir . '/.token' ) ) : '';
	wp_add_inline_script( 'vietnix-tools', 'window.VIETNIX_TOOLS = ' . wp_json_encode( [
		'token'    => $token,
		'api'      => 'http://127.0.0.1:8791',
		'templates'=> admin_url( 'edit.php?post_type=bricks_template' ),
	] ) . ';', 'before' );
} );

function vietnix_tools_screen() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$token = is_readable( __DIR__ . '/vietnix-tools/.token' );
	?>
	<div class="wrap vietnix-tools">
		<h1>Vietnix Tools</h1>
		<p class="vietnix-lead">Dán link Figma, xác nhận nội dung file không vẽ, rồi lấy một template. Bạn tự gắn template vào trang.</p>
		<?php if ( ! $token ) : ?>
			<div class="notice notice-warning"><p>Pipeline chưa chạy. Trên máy này: <code>node process/vietnix/server.mjs</code></p></div>
		<?php endif; ?>
		<ol class="vietnix-steps" aria-label="Các bước">
			<li data-step="links" class="is-current">1. Liên kết</li>
			<li data-step="confirm">2. Xác nhận</li>
			<li data-step="result">3. Kết quả</li>
		</ol>
		<div class="vietnix-board">
			<section class="vietnix-card" id="vietnix-links">
				<h2>Liên kết</h2>
				<p>Desktop là khung sẽ thành template. Tablet và Mobile là cùng khung đó ở bề rộng khác.</p>
				<label><span class="vietnix-label">Desktop <abbr class="vietnix-req" title="bắt buộc">*</abbr></span><input id="vn-desktop" type="url" placeholder="https://www.figma.com/design/…?node-id=…" required></label>
				<label>Tablet <input id="vn-tablet" type="url" placeholder="https://www.figma.com/design/…?node-id=…"></label>
				<label>Mobile <input id="vn-mobile" type="url" placeholder="https://www.figma.com/design/…?node-id=…"></label>
				<p class="vietnix-time" id="vn-plan-time"></p>
				<button type="button" class="button button-primary" id="vn-read">Đọc Figma</button>
				<p class="vietnix-msg" id="vn-link-msg"></p>
				<div class="vietnix-error" id="vn-link-error" hidden></div>
			</section>
			<section class="vietnix-card" id="vietnix-confirm">
				<h2>Xác nhận</h2>
				<div id="vn-confirm-body"><p class="vietnix-wait">Đọc Figma xong, các ô cần điền hiện ở đây.</p></div>
				<p class="vietnix-time" id="vn-build-time"></p>
				<button type="button" class="button button-primary" id="vn-build" disabled>Tạo template</button>
				<p class="vietnix-msg" id="vn-confirm-msg"></p>
				<div class="vietnix-error" id="vn-confirm-error" hidden></div>
			</section>
			<section class="vietnix-card" id="vietnix-result">
				<h2>Kết quả</h2>
				<div id="vn-result-body"><p class="vietnix-wait">Template hiện ở đây khi tạo xong. Bạn tự gắn nó trong Bricks.</p></div>
				<div class="vietnix-error" id="vn-result-error" hidden></div>
			</section>
		</div>
		<section class="vietnix-log" id="vn-log" hidden>
			<h2>Đang chạy</h2>
			<pre id="vn-log-body"></pre>
		</section>
	</div>
	<?php
}
