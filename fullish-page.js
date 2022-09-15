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
	#container;
	#wrapper;
	#panels;
	#currentPanelIndex;
	#currentScreenWidth;
	#defaults;
	#config;

	constructor(config = {}) {
		// Configurable variables
		this.#defaults = {
				selector: '.fullish-page',
				panelDepth: 1,
				scrollDelay: 1,
				tlPanelShowDuration: 1,
				tlPanelFreeScrollDuration: 2,
				tlPanelHideDuration: 1,
				tlPanelTransitionDuration: 1,
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
			'tlPanelTransition',
			'tlPanelShow',
			'tlPanelHide',
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
		this.#container = document.querySelector(this.#config.selector);
		this.#wrapper = document.querySelector(this.#config.selector + ' > .fullish-page-wrapper');
		this.#panels = gsap.utils.toArray(document.querySelectorAll(this.#config.selector + ' > .fullish-page-wrapper > .panel'));
		this.fullPage = null; // GSAP timeline handler for full-page mode
	}

	log(...params) {
		if (this.#config.debug) console.log(...params);
	}

	// TODO: Make it so it won't accept change on private variables: present returned value only for referencing
	get config() {
		return this.#config;
	}

	// TODO: Make it so it won't accept change on private variables: present returned value only for referencing
	get props() {
		return {
			mode: this.#mode,
			initialized: this.#initialized,
			container: this.#container,
			wrapper: this.#wrapper,
			panels: this.#panels,
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

		this.#panels.forEach((panel, i) => {
			panel.classList.add('panel-' + i);
		});

		// Set mode to either 'full-page' or 'static'
		this.setMode(this.#defineMode());

		// Finish initialization
		this.#initialized = true;
		this.#container.classList.add('fp-initialized');

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
			this.#container.setAttribute('data-fullish-page-mode', 'full-page');
			this.log('[FullishPage.setMode] Setting full-page mode.');
			this.fullPage = this.#fullPageTimeline();
			this.#container.classList.add('fp-mode-full-page');
		} else if (mode === 'static') {
			this.#container.setAttribute('data-fullish-page-mode', 'static');
			this.log('[FullishPage.setMode] Setting static mode.'); // TODO
			this.#container.classList.add('fp-mode-static');
			this.#currentPanelIndex = 0;
		}

		// Finish setting mode
		this.#mode = mode;
	}

	#defineMode() {
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

	#fullPageTimeline() {
		// Set height of container to the total scroll height of all panels
		gsap.set(this.#container, {
			height: (this.#panels.length * this.#config.panelDepth * 100) + "vh",
		});

		// Define timeline
		let timeline = gsap.timeline({
			scrollTrigger: {
				markers: this.#config.debug,
				trigger: this.#container,
				start: this.#config.triggerStart,
				end: this.#config.triggerEnd,
				scrub: this.#config.scrollDelay,
				fastScrollEnd: this.#config.fastScrollThreshold,
				onEnter: () => {
				},
				onEnterBack: () => {
				},
				onLeave: self => {
				},
				onLeaveBack: self => {
				}
			}
		});

		// Define timeline for each panels
		this.#panels.forEach((panel, panelIndex) => {    
			// Panel show
			timeline.add(this.tlPanelShow(panelIndex, panel))
				.duration(this.#config.tlPanelShowDuration);

			timeline.addLabel("panel-" + panelIndex);
			timeline.call(() => {
				this.#currentPanelIndex = panelIndex;
			});

			if (panelIndex < this.#panels.length - 1) {
				// Panel hide
				timeline.add(this.tlPanelHide(panelIndex, panel), ">" + this.#config.tlPanelFreeScrollDuration)
					.duration(this.#config.tlPanelHideDuration);

				// Panel transition
				timeline.add(this.tlPanelTransition(panelIndex))
					.duration(this.#config.tlPanelTransitionDuration);
			} else {
				timeline.addLabel("panels-end");
			}
		});

		return timeline;
	}

	destroy() {
		this.beforeDestroy();
		this.#container.classList.remove('fp-initialized');
		this.#initialized = false;

		let container = gsap.utils.selector(this.#container);
		if (this.#mode === 'full-page') {
			this.#container.classList.remove('fp-mode-full-page');
			this.fullPage.kill();
			this.fullPage = null;
			gsap.set([this.#container, container('*')], {
				clearProps: "all",
			});
		} else if (this.#mode === 'static') {
			this.#container.classList.remove('fp-mode-static');
		}

		window.removeEventListener('resize', this.onResize);

		this.#container.removeAttribute('data-fullish-page-mode');
		this.afterDestroy();
	}

	scrollTo(targetPanelIndex, smooth = true) {
		let targetDepth;

		if (this.#mode === 'full-page') {
			if (targetPanelIndex < 0)
				targetDepth = 0; // TODO: scrollTo before fp
			else if (targetPanelIndex < this.#panels.length)
				targetDepth = Math.ceil(this.fullPage.scrollTrigger.labelToScroll('panel-' + targetPanelIndex));
			else
				targetDepth = 0; // TODO: scrollTO after fp
		} else if (this.#mode === 'static') {
			targetDepth = this.#panels[targetPanelIndex].offsetTop;
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
	tlPanelTransition(prevPanelIndex) {
		let nextPanelIndex = prevPanelIndex + 1;

		let tl = gsap.timeline({ 
			defaults: {
				ease: Linear.easeNone,
			}
		});
		tl.to(this.props.panels[prevPanelIndex], {
			autoAlpha: 0,
		});
		tl.to(this.props.panels[nextPanelIndex], {
			autoAlpha: 1,
		}, "<");

		return tl;
	}

	tlPanelShow(panelIndex, panel) {
		let tl = gsap.timeline(),
		    p = gsap.utils.selector(this.props.panels[panelIndex]);

		tl.from(p('h2'), {
			fontSize: 0,
		});

		return tl;
	}

	tlPanelHide(panelIndex, panel) {
		let tl = gsap.timeline(),
		    p = gsap.utils.selector(this.props.panels[panelIndex]);

		tl.to(p('h2'), {
			fontSize: 0,
		});

		return tl;
	}

	beforeDestroy() {};
	afterDestroy() {};
};
