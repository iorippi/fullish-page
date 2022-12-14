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
			tlPanelShowDuration: 1,
			tlPanelHideDuration: 1,
			tlPanelTransitionDuration: 1,
			buttonNext: '.fullish-page-button-next',
			buttonPrev: '.fullish-page-butotn-prev',
			clearScrollMemory: true,
			defaultPanel: 0,
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

	set updateDefaultPanel(panelName) {
		let panelIndex = this.#checkIndex(panelName);
		if (panelIndex !== false)
			this.#config.defaultPanel = panelIndex;
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

	#checkIndex(panelName) {
		let panelIndex,
			  elem;

		// Check if the name is valid selector
		try {
			elem = document.querySelector(decodeURIComponent(panelName));
		} catch {
			elem = null;
		}
		if (elem !== null) {
			this.#panels.forEach((panel, i) => {
				if (panel === elem)
					panelIndex = i;
			});
		} else {
			// If not, assign the name as an index
			panelIndex = parseInt(panelName);
		}

		// Test index validity
		if (isNaN(panelIndex) || panelIndex < 0 || panelIndex >= this.#panels.length)
			return false;
		else
			return panelIndex;
	}

	#setCurrentPanelIndex(index) {
		index = parseInt(index);
		this.#currentPanelIndex = index;
		this.#container.setAttribute('data-current-panel', index);
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
			this.log('[FullishPage.onResize] Screen width resizing detected:', this.#currentScreenWidth, '->', screenWidth);
			this.#currentScreenWidth = screenWidth;
			this.destroy();
			this.init({ resized: true });
		}
	}

	init({ resized = false } = {}) {
		if (this.#config.clearScrollMemory)
			ScrollTrigger.clearScrollMemory();

		this.beforeInit(resized);

		// Set resize event action
		// Get the width of the window minus the scrollbar and borders
		this.#currentScreenWidth = document.body.clientWidth;
		if (!resized)
			this.onResize = this.onResize.bind(this);
		window.addEventListener('resize', this.onResize);

		// Measure innerHeight (Check with minimum window height for smartdevice)
		document.documentElement.style.setProperty('--inner-height', window.innerHeight + 'px');

		// Disable scroll history
		if (history.scrollRestoration)
			history.scrollRestoration = 'manual';

		this.#panels.forEach((panel, i) => {
			panel.classList.add('panel-' + i);
		});

		this.setButtons();

		// Set mode to either 'full-page' or 'static'
		this.setMode(this.#defineMode(), resized);

		// Finish initialization
		this.#initialized = true;
		this.#container.classList.add('fp-initialized');

		this.afterInit(resized);
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

	setMode(mode, resized = false) {
		// Check the parameter before execution.
		try {
			if (!this.#modes.includes(mode))
				throw `[FullishPage.setMode] Invalid parameter '${mode}' is passed as 'mode'. It must be either 'static' or 'full-page'`;
		} catch (e) {
			console.error(e);
			return;
		}

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
				type: "wheel,touch",
				wheelSpeed: -1,
				onDown: () => !this.#animating && this.gotoPrev(),
				onUp: () => !this.#animating && this.gotoNext(),
				tolerance: 10,
				preventDefault: true
			});

			this.#container.classList.add('fp-mode-full-page');

		} else if (mode === 'static') {
			this.#container.setAttribute('data-fullish-page-mode', 'static');
			this.log('[FullishPage.setMode] Setting static mode.');

			// Set GSAP ScrollTrigger
			this.#panels.forEach((panel, panelIndex) => {
				panel.classList.remove('played');
				let action = () => {
					// Play only the first time
					if (!panel.classList.contains('played')) {
						let tlPanelShowDuration = this.#config.tlPanelShowDuration,
								durationShow;
						if (typeof tlPanelShowDuration === "number")
							durationShow = tlPanelShowDuration;
						else
							durationShow = tlPanelShowDuration[panelIndex];

						this.tlPanelTransition(panelIndex, 'static');
						this.tlPanelShow(panelIndex, panel).duration(durationShow);
						panel.classList.add('played');
					}
				};
				ScrollTrigger.create({
					id: 'static-trigger-' + panelIndex,
					trigger: panel,
					start: 'top center',
					onEnter: () => {
						if (this.#initialized) {
							action();
							this.#setCurrentPanelIndex(panelIndex);
						}
					},
					onEnterBack: () => {
						if (this.#initialized) {
							this.#setCurrentPanelIndex(panelIndex);
						}
					},
				});
			});

			this.#container.classList.add('fp-mode-static');
		}

		// Finish setting mode
		this.#mode = mode;

		// Set panel
		if (resized)
			this.goto(this.#currentPanelIndex, false);
		else
			this.goto(this.#config.defaultPanel, false);
	}

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
				this.#setCurrentPanelIndex(panelIndex);
			});
			timeline.addLabel("panel-" + panelIndex);

			if (panelIndex < this.#panels.length - 1) {
				// Panel hide
				timeline.add(this.tlPanelHide(panelIndex, panel).duration(durations.hide));

				// Panel transition
				timeline.add(this.tlPanelTransition(panelIndex + 1).duration(durations.transition));
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
			this.gotoNextEvent = this.gotoNext.bind(this);
			this.btnNext.addEventListener('click', this.gotoNextEvent);
		}
		if (this.btnPrev) {
			this.twBtnPrev = gsap.to(this.btnPrev, btnDefault);
			this.gotoPrevEvent = this.gotoPrev.bind(this);
			this.btnPrev.addEventListener('click', this.gotoPrevEvent);
		}
	}

	toggleButtons(on = true) {
		if (this.btnNext) this.toggleNextButton(on);
		if (this.btnPrev) this.togglePrevButton(on);
	}

	toggleNextButton(on = true) {
		// Toggle on only if the current panel is not the last one
		if (on && this.#currentPanelIndex < this.#panels.length - 1) {
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
			this.#panels.forEach((panel, i) => {
				ScrollTrigger.getById('static-trigger-' + i).kill();
			});
		}

		if (this.btnNext)
			this.btnNext.removeEventListener('click', this.gotoNextEvent);
		if (this.btnPrev)
			this.btnPrev.removeEventListener('click', this.gotoPrevEvent);

		window.removeEventListener('resize', this.onResize);

		this.#container.removeAttribute('data-fullish-page-mode');
		this.#mode = null;
		this.afterDestroy();
	}

	goto(targetPanelName, smooth = true) {
		// Set the index
		let targetPanelIndex = this.#checkIndex(targetPanelName);
		if (targetPanelIndex === false) return;

		this.log(`[FullishPage.goto] Go to panel index ${targetPanelIndex}`);

		if (this.#mode === 'full-page') {
			this.#animating = true;
			this.#container.classList.add('animating');
			this.toggleButtons(false);
			let complete = () => {
				this.#animating = false;
				this.#container.classList.remove('animating');
				this.toggleButtons(true);
			}
			if (smooth) {
				fp.fullPage.tweenTo("panel-" + targetPanelIndex, {
					onComplete: complete,
				});
			} else {
				fp.fullPage.seek("panel-" + targetPanelIndex);
				complete();
			}
		} else if (this.#mode === 'static') {
			let targetDepth = this.#panels[targetPanelIndex].offsetTop;
			window.scroll({
				top: targetDepth + 1,
				left: 0,
				behavior: smooth ? 'smooth' : 'auto'
			});
		}

		this.#setCurrentPanelIndex(targetPanelIndex);
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
	tlPanelTransition(nextPanelIndex, mode = 'full-page') {
		let prevPanelIndex = nextPanelIndex - 1;

		let tl = gsap.timeline({ 
			defaults: {
				ease: Linear.easeNone,
			}
		});
		if (mode === 'full-page') {
			tl.to(this.props.panels[prevPanelIndex], {
				autoAlpha: 0,
			});
		}
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
