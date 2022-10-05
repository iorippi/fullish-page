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
	#animating;
	#indexWrap;
	#defaults;
	#config;

	constructor(config = {}) {
		// Configurable variables
		this.#defaults = {
				selector: '.fullish-page',
				panelDepth: 1,
				scrollDelay: 1,
				tlPanelShowDuration: 1,
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
		this.#panels = gsap.utils.toArray(document.querySelectorAll(this.#config.selector + ' .panel'));
		this.fullPage = null; // GSAP timeline handler for full-page mode

		// Set buttons
		this.btnNext = document.querySelector(this.#config.buttonNext);
		this.btnPrev = document.querySelector(this.#config.buttonPrev);
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
			panels: this.#panels,
			currentPanelIndex: this.#currentPanelIndex,
			currentScreenWidth: this.#currentScreenWidth,
			btnNext: this.btnNext,
			btnPrev: this.btnPrev,
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

		// Disable scroll history
		if (history.scrollRestoration)
			history.scrollRestoration = 'manual';

		// TODO: Disable scroll depth history; maybe make it configurable?

		this.#panels.forEach((panel, i) => {
			panel.classList.add('panel-' + i);
		});

		// Set mode to either 'full-page' or 'static'
		this.setMode(this.#defineMode());

		this.setButtons();

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
			gsap.set(document.documentElement, {
				overflow: 'hidden',
			});
			gsap.set(this.#container, {
				height: '100vh',
			});
			this.log('[FullishPage.setMode] Setting full-page mode.');
			this.fullPage = this.#fullPageTimeline();
			Observer.create({
				id: "full-page-observer",
				type: "wheel,touch,pointer",
				wheelSpeed: -1,
				onDown: () => !this.#animating && this.gotoPrev(),
				onUp: () => !this.#animating && this.gotoNext(),
				tolerance: 10,
				preventDefault: true
			});
			this.#currentPanelIndex = 0;
			this.goto(0);
			this.#container.classList.add('fp-mode-full-page');

		} else if (mode === 'static') {
			this.#container.setAttribute('data-fullish-page-mode', 'static');
			this.log('[FullishPage.setMode] Setting static mode.'); // TODO
			this.#currentPanelIndex = 0;
			this.#container.classList.add('fp-mode-static');
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
		// Define timeline
		let timeline = gsap.timeline({
			paused: true,
		});

		// Define timeline for each panels
		this.#panels.forEach((panel, panelIndex) => {    
			let tlPanelShowDuration = this.#config.tlPanelShowDuration,
			    tlPanelHideDuration = this.#config.tlPanelHideDuration;
			let durations = {
				show: null,
				hide: null,
				transition: this.#config.tlPanelTransitionDuration,
			};
			if (typeof tlPanelShowDuration === "number")
				durations.show = tlPanelShowDuration;
			else
				durations.show = tlPanelShowDuration[panelIndex];
			if (typeof tlPanelHideDuration === "number")
				durations.hide = tlPanelHideDuration;
			else
				durations.hide = tlPanelHideDuration[panelIndex];

			// Panel show
			timeline.add(this.tlPanelShow(panelIndex, panel).duration(durations.show));
			timeline.call(() => {
				this.log(`update index ${this.#currentPanelIndex} => ${panelIndex}`);
				this.#currentPanelIndex = panelIndex;
			});
			timeline.addLabel("panel-" + panelIndex);

			if (panelIndex < this.#panels.length - 1) {
				// Panel hide
				timeline.add(this.tlPanelHide(panelIndex, panel).duration(durations.hide));

				// Panel transition
				timeline.add(this.tlPanelTransition(panelIndex).duration(durations.transition));
			}
		});

		return timeline;
	}

	setButtons() {
		let btnDefault = {
				autoAlpha: 1,
				duration: 0.3,
				overwrite: true,
				paused: true,
			};

		if (this.btnNext) {
			this.twBtnNext = gsap.to(this.btnNext, btnDefault);
			this.btnNext.addEventListener('click', this.gotoNext.bind(this)); // TODO: fix scoping
		}
		if (this.btnPrev) {
			this.twBtnPrev = gsap.to(this.btnPrev, btnDefault);
			this.btnPrev.addEventListener('click', this.gotoPrev.bind(this)); // TODO: fix scoping
		}
	}

	toggleNextButton(on = true) {
		if (on) {
			this.twBtnNext.play();
		} else {
			this.twBtnNext.reverse();
		}
	}
	togglePrevButton(on = true) {
		if (on) {
			this.twBtnPrev.play();
		} else {
			this.twBtnPrev.reverse();
		}
	}

	destroy() {
		this.beforeDestroy();
		this.#container.classList.remove('fp-initialized');
		this.#initialized = false;

		let container = gsap.utils.selector(this.#container);
		if (this.#mode === 'full-page') {
			this.#container.classList.remove('fp-mode-full-page');
			Observer.getById('full-page-observer').kill();
			this.fullPage.kill();
			this.fullPage = null;
			gsap.set([this.#container, container('*')], {
				clearProps: "all",
			});
			gsap.set(document.documentElement, {
				overflow: '',
			});
		} else if (this.#mode === 'static') {
			this.#container.classList.remove('fp-mode-static');
		}

		// TODO: remove button eventlisteners and tween

		window.removeEventListener('resize', this.onResize);

		this.#container.removeAttribute('data-fullish-page-mode');
		this.#mode = null;
		this.afterDestroy();
	}

	goto(targetPanelIndex, smooth = true) {
		let targetDepth = null;

		if (this.#mode === 'full-page') {

			if (targetPanelIndex < 0)
				targetDepth = 0; // TODO: goto before fp
			else if (targetPanelIndex < this.#panels.length) {
				this.#animating = true;
				fp.fullPage.tweenTo("panel-" + targetPanelIndex, {
					onComplete: () => { this.#animating = false },
				});
			} else if (targetPanelIndex >= this.#panels.length)
				return; // Do nothing when scrollTO after fp

		} else if (this.#mode === 'static') {
			targetDepth = this.#panels[targetPanelIndex].offsetTop;
		}

		if (targetDepth !== null) {
			window.scroll({
				top: targetDepth + 1, // TODO: Revisit to check if `+1` is good enough
				left: 0,
				behavior: smooth ? 'smooth' : 'auto'
			});
		}
	}

	gotoNext() {
		this.goto(this.#currentPanelIndex + 1);
	}

	gotoPrev() {
		this.goto(this.#currentPanelIndex - 1);
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
