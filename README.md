# Fullish-Page

Responsive FullPage plugin (for GSAP)


## Use case

Fullish-Page is a responsive carousel plugin.
This combines a few unconventional combination:

1. Automatically sets up Full-page carousel ONLY WHEN the panels fits within the viewport.
2. Allows Full-page applied only partially to one or more sections in page to retain normal static flow for other parts.
3. Much of codebase relies on GSAP (Also GSAP ScrollTrigger), resulting in very lightweight addition if you already use GSAP to your project.

Note that if any of the above is not desirable to you, there are numerous conventional plugin and solutions provided there. This plugin is aimed to solve the specific edge case solution.

Here's a few other merits


## How to use

1. Load following plugins  
  - [GSAP core](https://cdnjs.cloudflare.com/ajax/libs/gsap/3.10.4/gsap.min.js)
  - [GSAP ScrollTrigger](https://cdnjs.cloudflare.com/ajax/libs/gsap/3.10.4/ScrollTrigger.min.js)
  - Fullish-Page.js

2. Execute following code

```
const fp = new FullPage({config}); 
fp.init();
```

## Settings

| **Option**                 | **Type** | **Default**       | **Description**                                                                                                                                                                    |   |
|----------------------------|----------|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| selector                   | string   | .fullish-page'    | Container's selector                                                                                                                                                               |   |
| panelDepth                 | integer  |                 1 | [Full-Page mode only] Each panel's scroll depth. (1 = 100vh)                                                                                                                       |   |
| panelTransitionDuration    | integer  |               0.5 | [Full-Page mode only] Duration for panel-to-panel transition animation. (in seconds) Must equal to `panelAnimationDelay - panelAnimationHideDuration`.                             |   |
| panelAnimationHideDuration | integer  |               0.5 | [Full-Page mode only] Duration for panel hiding animation. (in seconds) Must equal to `panelAnimationDelay - panelTransitionDuration`.                                             |   |
| panelAnimationDelay        | integer  |                 1 | [Full-Page mode only] Delay for panel showing animation. (in seconds) Must equal to `panelAnimationHideDuration + panelTransitionDuration`.                                        |   |
| fastScrollThreshold        | integer  |              2500 | Threshold for triggering `fastScroll` for GSAP ScrollTrigger and other animations to skip in case the speed was above the threshold. (pixels per second)                           |   |
| triggerStart               | string   | top top,          | GSAP ScrollTrigger `start` variable. [Refer to official document for the specification (Usage & special properties: `start`)](https://greensock.com/docs/v3/Plugins/ScrollTrigger) |   |
| triggerEnd                 | string   | bottom bottom,    | GSAP ScrollTrigger `end` variable. [Refer to official document for the specification (Usage & special properties: `end`)](https://greensock.com/docs/v3/Plugins/ScrollTrigger)     |   |
| buttonNext                 | string   | Implement feature | [TODO] Selector for next panel button                                                                                                                                              |   |
| buttonPrev                 | string   | Implement feature | [TODO] Selector for previous panel button                                                                                                                                          |   |
| debug                      | boolean  |       FALSE       | Debug flag. If set to `true`, it enables console output as well as GSAP ScrollTrigger's debugging feature.                                                                         |   |


## Configurable Methods

| **Option**      | **Type** | **Argument**                      | **Description**                                                                                                                                                             |   |
|-----------------|----------|-----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| beforeInit      | function | resized                           | Function to execute before `init()`                                                                                                                                         |   |
| afterInit       | function | resized                           | Function to execute after `init()`                                                                                                                                          |   |
| defineMode      | function |                                   | Function to decide which mode to set. Default is configured to check the viewport size against each panel to determine if it should set it to fullPage mode or static mode. |   |
| panelTransition | function | nextPanelIndex                    | Animation for panel-to-panel transition. Duration must match with `panelTransitionDuration`.                                                                                |   |
| panelActionShow | function | panel, panelIndex, isHighVelocity | Animation for panel showing animation.                                                                                                                                      |   |
| panelActionHide | function | panel, panelIndex, isHighVelocity | Animation for panel hiding animation. Duration must match with `panelAnimationHideDuration`.                                                                                |   |
| beforeDestroy   | function |                                   | Function to execute before `destroy()`                                                                                                                                      |   |
| afterDestroy    | function |                                   | Function to execute after `destroy()`                                                                                                                                       |   |


## Methods

| **Methods**  | **Argument**     | **Description**                                                                                                     |   |   |
|--------------|------------------|---------------------------------------------------------------------------------------------------------------------|---|---|
| config       |                  | Returns currently configured variables                                                                              |   |   |
| props        |                  | Returns various internal properties such as element objects for container, each panels, current index of the panel. |   |   |
| onResize     |                  | Function to be executed upon browser resize event                                                                   |   |   |
| setMode      |                  | Set mode (either `fullPage` or `static`)                                                                            |   |   |
| destroy      |                  | Undo initialization                                                                                                 |   |   |
| scrollTo     | targetPanelIndex | Scroll to the panel designated by index. (Count starts from 0)                                                      |   |   |
| scrollToNext |                  | Scroll to a next panel of the current panel                                                                         |   |   |
| scrollToPrev |                  | Scroll to a previous of the current panel                                                                           |   |   |


## Styling

Note below for configuring style.
Execution order and html attribute is organized as follows:

# Initialization
1. `beforeInit` is invoked.
2. Attribute [data-fullish-page-mode] is added to .fullish-page 
    at the beginningn of `setMode`.
3. Class name .fp-mode-full-page or .fp-mode-static is added to .fullish-page
    at the end of `setMode`.
4. Class name .fp-initialized is added
    towards the end of `init`.
5. `afterInit` is invoked.

# Destroy
1. `beforeDestroy` is invoked.
2. 2-4 in initialization process is executed in reverse order 
    execpt to remove the attribute.
3. `afterDestroy` is invoked.


## Sources
### GSAP
- [Green Sock official website](https://greensock.com/)
- [GSAP ScrollTrigger Documentation](https://greensock.com/docs/v3/Plugins/ScrollTrigger)

2022 Iori Tatsuguchi
