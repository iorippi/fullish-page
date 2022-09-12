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
	#modes = ['fullPage', 'static'];
	#mode = null; // [fullPage|static]
	#initialized = false;
	#fpContainer;
	#fpWrapper;
	#fpPanels;
	#currentPanelIndex = null;
	#currentScreenWidth = null;

	constructor(config = {}) {
		// Configurable variables
		Object.entries({
				selector: '.fullish-page',
				panelDepth: 1, // 1 = 100vh
				// Default:
				// panelAnimationDelay = panelTransitionDuration + panelAnimationHideDuration
				// -> Animation will start after both of the previous panel action (hide) and panel transition has finished
				panelTransitionDuration: 0.5, // seconds
				panelAnimationHideDuration: 0.5, // seconds
				panelAnimationDelay: 1, // seconds: 
				fastScrollThreshold: 2500, // pixels per second
				triggerStart: "top top",
				triggerEnd: "bottom bottom",
				nextButton: '.fullish-page-next', // TODO: Implement feature
				prevButton: '.fullish-page-prev', // TODO: Implement feature
				debug: false,
			}).forEach(entry => {
				this[entry[0]] = config[entry[0]] ? config[entry[0]] : entry[1];
			});
		// Configurable methods
		[
				'beforeInit',
				'afterInit',
				'defineMode',
				'panelTransition',
				'panelActionShow',
				'panelActionHide',
				'beforeDestroy',
				'afterDestroy',
			].forEach(funcName => {
				this[funcName] = config[funcName] ? config[funcName] : this[funcName];
			});

		// Set variables
		this.#fpContainer = document.querySelector(this.selector);
		this.#fpWrapper = document.querySelector(this.selector + ' > .fullish-page-wrapper');
		this.#fpPanels = gsap.utils.toArray(document.querySelectorAll(this.selector + ' > .fullish-page-wrapper > .panel'));
		this.fullPage = null; // GSAP timeline handler for full-page mode
	}

	log(...params) {
		if (this.debug) console.log(...params);
	}

	get props() {
		return {
			mode: this.#mode,
			container: this.#fpContainer,
			wrapper: this.#fpWrapper,
			panels: this.#fpPanels,
			currentPanelIndex: this.#currentPanelIndex,
			currentScreenWidth: this.#currentScreenWidth,
		}
	}

	/*
	 * Basic methods
	 */
	// Resize event handler
	onResize() {
		// Take action only when the width were changed.
		// Get the width of the window minus the scrollbar and borders
		let screenWidth = document.body.clientWidth;
		if (screenWidth === this.#currentScreenWidth) return;
		else {
			this.#currentScreenWidth = screenWidth;
			this.destroy();
			this.init(true);
		}
	}

	init(resized = false) {
		this.beforeInit(resized);

		// Set resize event action
		// Get the width of the window minus the scrollbar and borders
		this.#currentScreenWidth = document.body.clientWidth;
		if (!resized)
			this.onResize = this.onResize.bind(this);
		window.addEventListener('resize', this.onResize);

		// TODO: Disable scroll depth history; maybe make it configurable?

		// Set mode to either 'fullPage' or 'static'
		this.setMode(this.defineMode());

		// Finish initialization
		this.#initialized = true;
		this.#fpContainer.classList.add('fp-initialized');

		this.afterInit(resized);
	}

	setMode(mode, debug = false) {
		// Check the parameter before execution.
		try {
			if (!this.#modes.includes(mode))
				throw `[FullishPage.setMode] Invalid parameter '${mode}' is passed as 'mode'. It must be either 'static' or 'fullPage'`;
		} catch (e) {
			console.error(e);
			return;
		}

		// Set GSAP ScrollTrigger
		if (mode === 'fullPage') {
			this.#fpContainer.setAttribute('data-fullish-page-mode', 'full-page');
			this.log('[FullishPage.setMode] Setting full-page mode.');

			// Set height of container to the total scroll height of all panels
			gsap.set(this.#fpContainer, {
				height: (this.#fpPanels.length * this.panelDepth * 100) + "vh",
			});

			// Transition animation helper:
			// Wait for a moment until executing transition
			// to prevent panels in between the current and the target panel appearing mid-transition
			let panelTransitionTimer;
			let panelTransitionHandler = (nextIndex) => {
				clearTimeout(panelTransitionTimer);
				panelTransitionTimer = setTimeout(() => {
					this.panelTransitionExec(nextIndex);
				}, 100);
			}

			// Main timeline
			let fullPage = gsap.timeline({
				scrollTrigger: {
					markers: debug,
					trigger: this.#fpContainer,
					start: this.triggerStart,
					end: this.triggerEnd,
					scrub: true,
					fastScrollEnd: this.fastScrollThreshold,
					// Complete timeline for the first panel
					onEnter: () => {
						this.panelActionShowExec(this.#fpPanels[0], 0, 0); // Zero delay
					},
					// Complete timeline for the last panel
					// (fallback in case the last panel was not displayed in the last time scroll left the trigger)
					onEnterBack: () => {
						let lastIndex = this.#fpPanels.length - 1;
						this.panelTransitionExec(lastIndex, 0); // Zero delay
						this.panelActionShowExec(this.#fpPanels[lastIndex], lastIndex, this.panelTransitionDuration);
					},
				}
			});

			// Define timeline for each panels
			this.#fpPanels.forEach((panel, i, panels) => {    
				fullPage.addLabel("panel-" + i);

				// Panel action (show|hide)
				// NOTE: The first panel's initial `panelActionShowExec` is covered in `scrollTrigger.onEnter`
				if (i > 0) {
					fullPage.set(null, {
						onComplete: this.panelActionShowExec.bind(this),
						onCompleteParams: [panel, i],
						onReverseComplete: this.panelActionHideExec.bind(this),
						onReverseCompleteParams: [panel, i],
					});
				}

				// Panel free scroll
				fullPage.to(null , { duration: 1 });

				// NOTE: The last panel's `panelActionShowExec` on reverse is covered in `scrollTrigger.onEnterBack`
				if (i < panels.length - 1) { // Not the last panel
					// Panel action (hide|show)
					fullPage.set(null, {
						onComplete: this.panelActionHideExec.bind(this),
						onCompleteParams: [panel, i],
						onReverseComplete: this.panelActionShowExec.bind(this),
						onReverseCompleteParams: [panel, i],
					});

					// Panel transition
					fullPage.set(null, {
						onComplete: panelTransitionHandler.bind(this),
						onCompleteParams: [i + 1],
						onReverseComplete: panelTransitionHandler.bind(this),
						onReverseCompleteParams: [i],
					});
				}
			});

			// Finish setup for fullPage mode
			this.#currentPanelIndex = 0;
			this.fullPage = fullPage;
			this.#fpContainer.classList.add('fp-mode-full-page');

		} else if (mode === 'static') {
			this.#fpContainer.setAttribute('data-fullish-page-mode', 'static');
			this.log('[FullishPage.setMode] Setting static mode.'); // TODO
			this.#fpContainer.classList.add('fp-mode-static');
		}

		// Finish setting mode
		this.#mode = mode;
	}

	panelTransitionExec(nextPanelIndex, customDelay) {
		let delay;
		if (customDelay !== undefined)
			delay = customDelay;
		else
			delay = this.panelAnimationHideDuration;

		setTimeout(() => {
			this.panelTransition(nextPanelIndex);
		}, delay);
		this.#currentPanelIndex = nextPanelIndex;
	};

	panelActionShowExec(panel, panelIndex, customDelay) {
		let isHighVelocity = (Math.abs(this.fullPage.scrollTrigger.getVelocity()) >= this.fastScrollThreshold),
		    delay;
		if (customDelay !== undefined)
			delay = customDelay;
		else
			delay = this.panelAnimationDelay * 1000;

		setTimeout(() => {
			this.panelActionShow(panel, panelIndex, isHighVelocity);
		}, delay);
	};

	panelActionHideExec(panel, panelIndex) {
		let isHighVelocity = (Math.abs(this.fullPage.scrollTrigger.getVelocity()) >= this.fastScrollThreshold);
		this.panelActionHide(panel, panelIndex, isHighVelocity);
	};

	destroy() {
		this.beforeDestroy();
		this.#fpContainer.classList.remove('fp-initialized');
		this.#initialized = false;

		let container = gsap.utils.selector(this.#fpContainer);
		if (this.#mode === 'fullPage') {
			this.#fpContainer.classList.remove('fp-mode-full-page');
			this.fullPage.kill();
			this.fullPage = null;
			gsap.set([this.#fpContainer, container('*')], {
				clearProps: "all",
			});
		} else if (this.#mode === 'static') {
			this.#fpContainer.classList.remove('fp-mode-static');
		}

		window.removeEventListener('resize', this.onResize);

		this.#fpContainer.removeAttribute('data-fullish-page-mode');
		this.afterDestroy();
	}

	scrollTo(targetPanelIndex, smooth = true) {
		let targetDepth;

		if (this.#mode === 'fullPage') {
			if (targetPanelIndex < 0)
				targetDepth = 0; // TODO: scrollTo before fp
			else if (targetPanelIndex < this.#fpPanels.length)
				targetDepth = Math.ceil(this.fullPage.scrollTrigger.labelToScroll('panel-' + i));
			else
				targetDepth = 0; // TODO: scrollTO after fp
		} else if (this.#mode === 'static') {
			targetDepth = this.#fpPanels[targetPanelIndex].offsetTop;
		}
		window.scroll({
			top: targetDepth + 1, // TODO: Revisit to check if `+1` is good enough
			left: 0,
			behavior: smooth ? 'smooth' : 'auto'
		});
	}

	scrollToNext() {
		this.scrollTo(this.#currentPanelIndex + 1);
	}

	scrollToPrev() {
		this.scrollTo(this.#currentPanelIndex - 1);
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
		let maxPanelHeight = this.#fpPanels.reduce((prevHeight, curPanel) => {
			return Math.max(prevHeight, curPanel.scrollHeight);
		}, 0);

		// Set mode to static if any panel is higher than the height of the window
		if (maxPanelHeight > screenHeight)
			return 'static';
		else
			return 'fullPage';
	};

	panelTransition(nextPanelIndex) {
		this.log(`Panel: transition ${this.#currentPanelIndex} => ${nextPanelIndex}`);

		let tl = gsap.timeline({ 
			defaults: {
				overwrite: true,
				duration: this.panelTransitionDuration,
				ease: "none",
			}
		});
		tl.to(this.#fpPanels, {
			autoAlpha: 0,
		});
		tl.to(this.#fpPanels[nextPanelIndex], {
			autoAlpha: 1,
		}, "<");
	}

	panelActionShow(panel, panelIndex, isHighVelocity) {
		this.log(`Panel: action (show) ${panelIndex}`);

		let p = gsap.utils.selector(panel);
		gsap.to(p('h2'), {
			fontSize: 100
		});
	}

	panelActionHide(panel, panelIndex, isHighVelocity) {
		this.log(`Panel: action (hide) ${panelIndex}`);

		let p = gsap.utils.selector(panel);
		gsap.to(p('h2'), {
			fontSize: 0
		});
	}

	beforeDestroy() {};
	afterDestroy() {};
};
