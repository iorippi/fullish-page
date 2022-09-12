/*
 * Fullish-Page
 * - FullPage x GSAP ScrollTrigger (パネル・フェード型)
 *
 * GSAP プラグインを使用した全画面カルーセル。
 * 通常フローのページ中に FullPage 領域を設ける際に使用可能。
 * コンテンツとビューポートのサイズを比較し、
 * フルページ表示と通常の表示を自動で切り替える。
 *
 * # メリット：
 * - Panel が変わる瞬間のアニメーションを固定可能（深度とアニメーションの進行を同期させる場合はこのプラグインは使用不可）
 * 
 * # 対応している動き：
 * - 画面領域を覆うパネル間をフェードイン・アウトで行き来する遷移
 *   （前後のパネルが重なって表示される必要がある場合に対応。）
 * - FullPage 領域の前後の通常スクロールのフローを維持したい場合にも対応
 *
 * # 対応していない動き：
 * - パネルが上下方向にスライドしていくタイプの遷移
 * - 複数のパネルで区切らずに流動的なアニメーションで再現する遷移
 *
 * # 使用方法
 * ```
 * const fp = new FullPage({config}); 
 * fp.init();
 * ```
 *
 * 2022 Iori Tatsuguchi
 */

// Register dependency GSAP plugin
gsap.registerPlugin(ScrollTrigger);

const FullishPage = class {
	constructor(config = {}) {
		// Configurable variables
		Object.entries({
				fpContainerSel: '.fullish-page',
				panelDepth: 1, // 1 = 100vh
				panelTransitionDuration: 1, // seconds
				fastScrollThreshold: 2500, // pixels per second
				triggerStart: "top top",
				triggerEnd: "bottom bottom",
			}).forEach(e => {
				this[e[0]] = config[e[0]] ? config[e[0]] : e[1];
			});
		// Configurable methods
		[
				'beforeInit',
				'afterInit',
				'defineMode',
				'beforePanelTransition',
				'panelTransition',
				'afterPanelTransition',
				'onLeave',
				'onEnter',
				'beforeDestroy',
				'afterDestroy',
			].forEach(funcName => {
				this[funcName] = config[funcName] ? config[funcName] : this[funcName];
			});

		// Set variables
		this.initialized = false;
		this.mode = null; // [fullPage|static]
		this.modes = ['fullPage', 'static'];
		this.fpContainer = document.querySelector(this.fpContainerSel);
		this.fpWrapper = document.querySelector(this.fpContainerSel + ' > .fullish-page-wrapper');
		this.fpPanels = gsap.utils.toArray(document.querySelectorAll(this.fpContainerSel + ' > .fullish-page-wrapper > .panel'));
		this.currentPanelIndex = null;
		this.currentScreenWidth = null;
		this.fullPage = null; // GSAP timeline handler for full-page mode
	}

	/*
	 * Basic methods
	 */
	// Resize event handler
	onResize() {
		// Take action only when the width were changed.
		// Get the width of the window minus the scrollbar and borders
		let screenWidth = document.body.clientWidth;
		if (screenWidth === this.currentScreenWidth) return;
		else {
			this.currentScreenWidth = screenWidth;
			this.destroy();
			this.init(true);
		}
	}

	init(resized = false) {
		this.beforeInit(resized);

		// Set resize event action
		// Get the width of the window minus the scrollbar and borders
		this.currentScreenWidth = document.body.clientWidth;
		if (!resized)
			this.onResize = this.onResize.bind(this);
		window.addEventListener('resize', this.onResize);

		// TODO: Disable scroll depth history; maybe make it configurable?

		// Set mode to either 'fullPage' or 'static'
		this.setMode(this.defineMode());

		// Finish initialization
		this.initialized = true;
		this.fpContainer.classList.add('fp-initialized');

		this.afterInit(resized);
	}

	setMode(mode, debug = false) {
		// Check the parameter before execution.
		try {
			if (!this.modes.includes(mode))
				throw `[FullishPage.setMode] Invalid parameter '${mode}' is passed as 'mode'. It must be either 'static' or 'fullPage'`;
		} catch (e) {
			console.error(e);
			return;
		}

		// Set GSAP ScrollTrigger
		if (mode === 'fullPage') {
			this.fpContainer.setAttribute('data-fullish-page-mode', 'full-page');
			console.info('[FullishPage.setMode] Setting full-page mode.');
			// Set height of container to the total scroll height of all panels
			gsap.set(this.fpContainer, {
				height: (this.fpPanels.length * this.panelDepth * 100) + "vh",
			});

			let fullPage = gsap.timeline({
				scrollTrigger: {
					markers: debug,
					trigger: this.fpContainer,
					start: this.triggerStart,
					end: this.triggerEnd,
					scrub: true,
					fastScrollEnd: this.fastScrollThreshold,
				}
			});

			let panelTransitionTimer;
			let panelTransitionHandler = (nextIndex) => {
				clearTimeout(panelTransitionTimer);
				panelTransitionTimer = setTimeout(() => {
					this.panelTransition(nextIndex);
				}, 100);
			}

			this.fpPanels.forEach((panel, i, panels) => {    
				fullPage.addLabel("panel-" + i);

				// Panel action (show)
				// NOTE: Adding minimum duration tween as a workaround for GSAP spec.
				//       Zero duration tween at the beginning of timeline 
				//       including .to[onComplete], .set and .call won't be executed
				//       upon the positive direciton scroll 2nd time and later.
				let durationPadding = 1 / 1000000000;
				fullPage.to(null, { duration: durationPadding });
				fullPage.call(this.beforePanelTransition.bind(this), [panel, i, panels]);

				// Panel free scroll
				fullPage.to(null , { duration: 1 });

				// Panel action (hide)
				fullPage.call(this.afterPanelTransition.bind(this), [panel, i, panels]);

				// Panel transition
				if (i < panels.length - 1) { // not the last panel
					fullPage.set(fp.fpContainer, {
						onComplete: panelTransitionHandler.bind(this),
						onCompleteParams: [i + 1],
						onReverseComplete: panelTransitionHandler.bind(this),
						onReverseCompleteParams: [i],
					});
				}
			});

			this.fpContainer.classList.add('fp-mode-full-page');

			this.fullPage = fullPage;

		} else if (mode === 'static') {
			this.fpContainer.setAttribute('data-fullish-page-mode', 'static');
			console.info('[FullishPage.setMode] Setting static mode.'); // TODO
			this.fpContainer.classList.add('fp-mode-static');
		}

		// Finish setting mode
		this.mode = mode;
	}

	destroy() {
		this.beforeDestroy();
		this.fpContainer.classList.remove('fp-initialized');

		this.fpContainer.classList.remove('fp-mode-full-page', 'fp-mode-static');
		// TODO: remove GSAP ScrollTrigger here.
		this.fullPage.kill();

		window.removeEventListener('resize', this.onResize);

		this.fpContainer.removeAttribute('data-fullish-page-mode');
		this.afterDestroy();
	}

	scrollTo(targetPanelIndex, smooth = true) {
		let targetDepth;

		if (this.mode === 'fullPage') {
			targetDepth = Math.ceil(this.fullPage.scrollTrigger.labelToScroll('panel-' + i));
		} else if (this.mode === 'static') {
			targetDepth = this.fpPanels[targetPanelIndex].offsetTop;
		}
		window.scroll({
			top: targetDepth + 1, // TODO: Revisit to check if `+1` is good enough
			left: 0,
			behavior: smooth ? 'smooth' : 'auto'
		});
	}

	scrollToNext() {
		this.scrollTo(this.currentPanelIndex + 1);
	}

	scrollToPrev() {
		this.scrollTo(this.currentPanelIndex - 1);
	}

	/* 
	 * Configurable methods
	 */
	beforeInit(resized) {};
	afterInit(resized) {};
	defineMode() {
		// Determines adequate mode and return the mode name [static|fullPage]
		// Get the height of the window minus the scrollbar and borders
		let screenHeight = window.innerHeight;

		// Get the biggest height of panels
		let maxPanelHeight = this.fpPanels.reduce((prevHeight, curPanel) => {
			return Math.max(prevHeight, curPanel.scrollHeight);
		}, 0);

		// Set mode to static if any panel is higher than the height of the window
		if (maxPanelHeight > screenHeight)
			return 'static';
		else
			return 'fullPage';
	};
	beforePanelTransition(panel, panelIndex, panels) {
		let velocity = Math.abs(this.fullPage.scrollTrigger.getVelocity());
		if (velocity < this.fastScrollThreshold)
			console.log(`Panel: action (before) ${panelIndex}`);
	};
	panelTransition(nextPanelIndex) {
		gsap.to(this.fpPanels, {
			overwrite: true,
			autoAlpha: 0,
			duration: this.panelTransitionDuration,
		});
		gsap.to(this.fpPanels[nextPanelIndex], {
			overwrite: true,
			autoAlpha: 1,
			duration: this.panelTransitionDuration,
		});
		this.currentPanelIndex = nextPanelIndex;
	};
	afterPanelTransition(panel, panelIndex, panels) {
		let velocity = Math.abs(this.fullPage.scrollTrigger.getVelocity());
		if (velocity < this.fastScrollThreshold)
			console.log(`Panel: action (after) ${panelIndex}`);
	};
	onLeave(direction) {};
	onEnter(direction) {};
	beforeDestroy() {};
	afterDestroy() {};
};
