/* -------------------------------------- *
 * Fullish-Page
 * Responsive FullPage plugin (for GSAP)
 *
 * 2022 Iori Tatsuguchi
 * -------------------------------------- */

// Register dependency GSAP plugin
gsap.registerPlugin(ScrollTrigger);

const FullishPage = class {
	#modes;
	#mode;
	#initialized;
	#fpContainer;
	#fpWrapper;
	#fpPanels;
	#currentPanelIndex;
	#currentScreenWidth;
	#defaults;
	#config;

	constructor(config = {}) {
		// Configurable variables
		this.#defaults = {
				selector: '.fullish-page',
				panelDepth: 1,
				scrollWait: 0.1,
				panelTransitionDuration: 1,
				panelAnimationHideDuration: 1,
				panelAnimationDelay: 2,
				panelAnimationShowDuration: 1,
				fastScrollThreshold: 2500,
				triggerStart: "top top",
				triggerEnd: "bottom bottom",
				buttonNext: '.fullish-page-button-next', // TODO: Implement feature
				buttonPrev: '.fullish-page-butotn-prev', // TODO: Implement feature
				debug: false,
		};
		// Set configuration (override defaults)
		this.#config = {};
		Object.entries(this.#defaults).forEach(entry => {
			this.#config[entry[0]] = config[entry[0]] ? config[entry[0]] : entry[1];
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
		this.#modes = ['fullPage', 'static'];
		this.#mode = null; // [fullPage|static]
		this.#initialized = false;
		this.#currentPanelIndex = null;
		this.#currentScreenWidth = null;
		this.#fpContainer = document.querySelector(this.#config.selector);
		this.#fpWrapper = document.querySelector(this.#config.selector + ' > .fullish-page-wrapper');
		this.#fpPanels = gsap.utils.toArray(document.querySelectorAll(this.#config.selector + ' > .fullish-page-wrapper > .panel'));
		this.fullPage = null; // GSAP timeline handler for full-page mode

		// Initialize scrollKiller
		FullishPage.scrollKiller.init();	
	}

	log(...params) {
		if (this.#config.debug) console.log(...params);
	}

	get config() {
		return this.#config;
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

	setMode(mode) {
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
			this.fullPage = this.#fullPageTimeline();
			this.#currentPanelIndex = 0;
			this.#fpContainer.classList.add('fp-mode-full-page');
		} else if (mode === 'static') {
			this.#fpContainer.setAttribute('data-fullish-page-mode', 'static');
			this.log('[FullishPage.setMode] Setting static mode.'); // TODO
			this.#fpContainer.classList.add('fp-mode-static');
		}

		// Finish setting mode
		this.#mode = mode;
	}

	#fullPageTimeline() {
		this.#fpContainer.setAttribute('data-fullish-page-mode', 'full-page');
		this.log('[FullishPage.setMode] Setting full-page mode.');

		// Set height of container to the total scroll height of all panels
		gsap.set(this.#fpContainer, {
			height: (this.#fpPanels.length * this.#config.panelDepth * 100) + "vh",
		});

		// Transition animation helper:
		// Wait for a moment until executing transition
		// to prevent panels in between the current and the target panel appearing mid-transition
		let panelTransitionTimer;
		let panelTransitionHandler = (nextIndex) => {
			clearTimeout(panelTransitionTimer);
			panelTransitionTimer = setTimeout(() => {
				// Kill scrolling until show animation is triggered
				FullishPage.scrollKiller.disableScroll();

				panelTransitionExec(nextIndex);
			}, this.#config.scrollWait * 1000);
		}

		// Panel transition wrapper function
		let panelTransitionExec = (nextPanelIndex, customDelay) => {
			let delay;
			if (customDelay !== undefined)
				delay = customDelay;
			else
				delay = this.#config.panelAnimationHideDuration;

			gsap.delayedCall(delay, () => {
				this.panelTransition(nextPanelIndex);
			});
			this.#currentPanelIndex = nextPanelIndex;
		};

		// Panel action wrapper functions
		let panelActionShowExec = (panel, panelIndex, customDelay) => {
			let isHighVelocity = (Math.abs(this.fullPage.scrollTrigger.getVelocity()) >= this.#config.fastScrollThreshold),
					delay;
			if (customDelay !== undefined)
				delay = customDelay;
			else
				delay = this.#config.panelAnimationDelay;

			gsap.delayedCall(delay, () => {
				this.panelActionShow(panel, panelIndex, isHighVelocity);

				// Enable scroll again
				gsap.delayedCall(this.#config.panelAnimationShowDuration, () => {
					FullishPage.scrollKiller.enableScroll();
				});
			});
		};
		let panelActionHideExec = (panel, panelIndex) => {
			let isHighVelocity = (Math.abs(this.fullPage.scrollTrigger.getVelocity()) >= this.#config.fastScrollThreshold);
			this.panelActionHide(panel, panelIndex, isHighVelocity);
		};

		// Define timeline
		let timeline = gsap.timeline({
			scrollTrigger: {
				markers: this.#config.debug,
				trigger: this.#fpContainer,
				start: this.#config.triggerStart,
				end: this.#config.triggerEnd,
				scrub: true,
				fastScrollEnd: this.#config.fastScrollThreshold,
				// Complete timeline for the first panel
				onEnter: () => {
					panelActionShowExec.bind(this, this.#fpPanels[0], 0, 0); // Zero delay
				},
				// Complete timeline for the last panel
				// (fallback in case the last panel was not displayed in the last time scroll left the trigger)
				onEnterBack: () => {
					let lastIndex = this.#fpPanels.length - 1;
					panelTransitionExec.bind(this, lastIndex, 0); // Zero delay
					panelActionShowExec.bind(this, this.#fpPanels[lastIndex], lastIndex, this.#config.panelTransitionDuration);
				},
				onLeave: self => {
					if (self.isActive) FullishPage.scrollKiller.enableScroll();
				},
				onLeaveBack: self => {
					if (self.isActive) FullishPage.scrollKiller.enableScroll();
				}
			}
		});

		// Define timeline for each panels
		this.#fpPanels.forEach((panel, i, panels) => {    
			timeline.addLabel("panel-" + i);

			// Panel action (show|hide)
			// NOTE: The first panel's initial `panelActionShowExec` is covered in `scrollTrigger.onEnter`
			if (i > 0) {
				timeline.set(null, {
					onComplete: panelActionShowExec.bind(this),
					onCompleteParams: [panel, i],
					onReverseComplete: panelActionHideExec.bind(this),
					onReverseCompleteParams: [panel, i],
				});
			}

			// Panel free scroll
			timeline.to(null , { duration: 1 });

			// NOTE: The last panel's `panelActionShowExec` on reverse is covered in `scrollTrigger.onEnterBack`
			if (i < panels.length - 1) { // Not the last panel
				// Panel action (hide|show)
				timeline.set(null, {
					onComplete: panelActionHideExec.bind(this),
					onCompleteParams: [panel, i],
					onReverseComplete: panelActionShowExec.bind(this),
					onReverseCompleteParams: [panel, i],
				});

				// Panel transition
				timeline.set(null, {
					onComplete: panelTransitionHandler.bind(this),
					onCompleteParams: [i + 1],
					onReverseComplete: panelTransitionHandler.bind(this),
					onReverseCompleteParams: [i],
				});
			}
		});

		return timeline;
	}

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

	static scrollKiller = {
		// @gblazex
		// https://stackoverflow.com/a/4770179
		
		initialized: false,

		// left: 37, up: 38, right: 39, down: 40,
		// spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36
		keys: {
			37: 1, 38: 1, 39: 1, 40: 1,
			32: 1, 33: 1, 34: 1, 35: 1, 36: 1,
		},

		preventDefault(e) {
			e.preventDefault();
		},

		preventDefaultForScrollKeys(e) {
			if (this.keys[e.keyCode]) {
				this.preventDefault(e);
				return false;
			}
		},

		wheelOpt: undefined,
		wheelEvent: undefined,

		init() {
			if (this.initialized) return;

			// modern Chrome requires { passive: false } when adding event
			let supportsPassive = false;

			try {
				window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
					get: function () { supportsPassive = true; } 
				}));
			} catch(e) {}

			this.wheelOpt = supportsPassive ? { passive: false } : false;
			this.wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
		},

		// call this to Disable
		disableScroll() {
			if (!this.initialized) this.init();
			window.addEventListener('DOMMouseScroll', this.preventDefault, false); // older FF
			window.addEventListener(this.wheelEvent, this.preventDefault, this.wheelOpt); // modern desktop
			window.addEventListener('touchmove', this.preventDefault, this.wheelOpt); // mobile
			window.addEventListener('keydown', this.preventDefaultForScrollKeys, false);
			console.info("scrollKiller: Scroll disabled");
		},

		// call this to Enable
		enableScroll() {
			if (!this.initialized) this.init();
			window.removeEventListener('DOMMouseScroll', this.preventDefault, false);
			window.removeEventListener(this.wheelEvent, this.preventDefault, this.wheelOpt); 
			window.removeEventListener('touchmove', this.preventDefault, this.wheelOpt);
			window.removeEventListener('keydown', this.preventDefaultForScrollKeys, false);
			console.info("scrollKiller: Scroll enabled");
		}
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
				duration: this.#config.panelTransitionDuration,
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
			fontSize: 100,
			duration: this.#config.panelAnimationShowDuration,
		});
	}

	panelActionHide(panel, panelIndex, isHighVelocity) {
		this.log(`Panel: action (hide) ${panelIndex}`);

		let p = gsap.utils.selector(panel);
		gsap.to(p('h2'), {
			fontSize: 0,
			duration: this.#config.panelAnimationHideDuration,
		});
	}

	beforeDestroy() {};
	afterDestroy() {};
};
