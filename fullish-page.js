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
		this.#modes = ['full-page', 'static'];
		this.#mode = null; // [full-page|static]
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
		if (this.config.debug) console.log(...params);
	}

	get config() {
		return this.#config;
	}

	get props() {
		return {
			mode: this.#mode,
			initialized: this.#initialized,
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
		if (screenWidth === this.props.currentScreenWidth) return;
		else {
			this.props.currentScreenWidth = screenWidth;
			this.destroy();
			this.init(true);
		}
	}

	init(resized = false) {
		this.beforeInit(resized);

		// Set resize event action
		// Get the width of the window minus the scrollbar and borders
		this.props.currentScreenWidth = document.body.clientWidth;
		if (!resized)
			this.onResize = this.onResize.bind(this);
		window.addEventListener('resize', this.onResize);

		// TODO: Disable scroll depth history; maybe make it configurable?

		this.props.panels.forEach((panel, i) => {
			panel.classList.add('panel-' + i);
		});

		// Set mode to either 'full-page' or 'static'
		this.setMode(this.defineMode());

		// Finish initialization
		this.props.initialized = true;
		this.props.container.classList.add('fp-initialized');

		this.afterInit(resized);
	}

	setMode(mode) {
		// Check the parameter before execution.
		try {
			if (!this.#modes.includes(mode))
				throw `[FullishPage.setMode] Invalid parameter '${mode}' is passed as 'mode'. It must be either 'static' or 'full-page'`;
		} catch (e) {
			console.error(e);
			return;
		}

		// Set GSAP ScrollTrigger
		if (mode === 'full-page') {
			this.fullPage = this.#fullPageTimeline();
			this.props.currentPanelIndex = 0;
			this.props.container.classList.add('fp-mode-full-page');
		} else if (mode === 'static') {
			this.props.container.setAttribute('data-fullish-page-mode', 'static');
			this.log('[FullishPage.setMode] Setting static mode.'); // TODO
			this.props.container.classList.add('fp-mode-static');
		}

		// Finish setting mode
		this.props.mode = mode;
	}

	#fullPageTimeline() {
		this.props.container.setAttribute('data-fullish-page-mode', 'full-page');
		this.log('[FullishPage.setMode] Setting full-page mode.');

		// Set height of container to the total scroll height of all panels
		gsap.set(this.props.container, {
			height: (this.props.panels.length * this.config.panelDepth * 100) + "vh",
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
			}, this.config.scrollWait * 1000);
		}

		// Panel transition wrapper function
		let panelTransitionExec = (nextPanelIndex, customDelay) => {
			let delay;
			if (customDelay !== undefined)
				delay = customDelay;
			else
				delay = this.config.panelAnimationHideDuration;

			gsap.delayedCall(delay, () => {
				this.panelTransition(nextPanelIndex);
			});
			this.props.currentPanelIndex = nextPanelIndex;
		};

		// Panel action wrapper functions
		let panelActionShowExec = (panel, panelIndex, customDelay) => {
			let isHighVelocity = (Math.abs(this.fullPage.scrollTrigger.getVelocity()) >= this.config.fastScrollThreshold),
					delay;
			if (customDelay !== undefined)
				delay = customDelay;
			else
				delay = this.config.panelAnimationDelay;

			gsap.delayedCall(delay, () => {
				this.panelActionShow(panel, panelIndex, isHighVelocity);

				// Enable scroll again
				gsap.delayedCall(this.config.panelAnimationShowDuration, () => {
					FullishPage.scrollKiller.enableScroll();
				});
			});
		};
		let panelActionHideExec = (panel, panelIndex) => {
			let isHighVelocity = (Math.abs(this.fullPage.scrollTrigger.getVelocity()) >= this.config.fastScrollThreshold);
			this.panelActionHide(panel, panelIndex, isHighVelocity);
		};

		// Define timeline
		let timeline = gsap.timeline({
			scrollTrigger: {
				markers: this.config.debug,
				trigger: this.props.container,
				start: this.config.triggerStart,
				end: this.config.triggerEnd,
				scrub: true,
				fastScrollEnd: this.config.fastScrollThreshold,
				// Complete timeline for the first panel
				onEnter: () => {
					panelActionShowExec.bind(this, this.props.panels[0], 0, 0); // Zero delay
				},
				// Complete timeline for the last panel
				// (fallback in case the last panel was not displayed in the last time scroll left the trigger)
				onEnterBack: () => {
					let lastIndex = this.props.panels.length - 1;
					panelTransitionExec.bind(this, lastIndex, 0); // Zero delay
					panelActionShowExec.bind(this, this.props.panels[lastIndex], lastIndex, this.config.panelTransitionDuration);
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
		this.props.panels.forEach((panel, i, panels) => {    
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
		this.props.container.classList.remove('fp-initialized');
		this.props.initialized = false;

		let container = gsap.utils.selector(this.props.container);
		if (this.props.mode === 'full-page') {
			this.props.container.classList.remove('fp-mode-full-page');
			this.fullPage.kill();
			this.fullPage = null;
			gsap.set([this.props.container, container('*')], {
				clearProps: "all",
			});
		} else if (this.props.mode === 'static') {
			this.props.container.classList.remove('fp-mode-static');
		}

		window.removeEventListener('resize', this.onResize);

		this.props.container.removeAttribute('data-fullish-page-mode');
		this.afterDestroy();
	}

	scrollTo(targetPanelIndex, smooth = true) {
		let targetDepth;

		if (this.props.mode === 'full-page') {
			if (targetPanelIndex < 0)
				targetDepth = 0; // TODO: scrollTo before fp
			else if (targetPanelIndex < this.props.panels.length)
				targetDepth = Math.ceil(this.fullPage.scrollTrigger.labelToScroll('panel-' + i));
			else
				targetDepth = 0; // TODO: scrollTO after fp
		} else if (this.props.mode === 'static') {
			targetDepth = this.props.panels[targetPanelIndex].offsetTop;
		}
		window.scroll({
			top: targetDepth + 1, // TODO: Revisit to check if `+1` is good enough
			left: 0,
			behavior: smooth ? 'smooth' : 'auto'
		});
	}

	scrollToNext() {
		this.scrollTo(this.props.currentPanelIndex + 1);
	}

	scrollToPrev() {
		this.scrollTo(this.props.currentPanelIndex - 1);
	}

	/* 
	 * Configurable methods
	 */
	beforeInit(resized) {};
	afterInit(resized) {};
	defineMode() {
		// Determines adequate mode and return the mode name [static|full-page]
		// Get the height of the window minus the scrollbar and borders
		let screenHeight = window.innerHeight;

		// Get the biggest height of panels
		let maxPanelHeight = this.props.panels.reduce((prevHeight, curPanel) => {
			return Math.max(prevHeight, curPanel.scrollHeight);
		}, 0);

		// Set mode to static if any panel is higher than the height of the window
		if (maxPanelHeight > screenHeight)
			return 'static';
		else
			return 'full-page';
	};

	panelTransition(nextPanelIndex) {
		this.log(`Panel: transition ${this.props.currentPanelIndex} => ${nextPanelIndex}`);

		let tl = gsap.timeline({ 
			defaults: {
				overwrite: true,
				duration: this.config.panelTransitionDuration,
				ease: "none",
			}
		});
		tl.to(this.props.panels, {
			autoAlpha: 0,
		});
		tl.to(this.props.panels[nextPanelIndex], {
			autoAlpha: 1,
		}, "<");
	}

	panelActionShow(panel, panelIndex, isHighVelocity) {
		this.log(`Panel: action (show) ${panelIndex}`);

		let p = gsap.utils.selector(panel);
		gsap.to(p('h2'), {
			fontSize: 100,
			duration: this.config.panelAnimationShowDuration,
		});
	}

	panelActionHide(panel, panelIndex, isHighVelocity) {
		this.log(`Panel: action (hide) ${panelIndex}`);

		let p = gsap.utils.selector(panel);
		gsap.to(p('h2'), {
			fontSize: 0,
			duration: this.config.panelAnimationHideDuration,
		});
	}

	beforeDestroy() {};
	afterDestroy() {};
};
