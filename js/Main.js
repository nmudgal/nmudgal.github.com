(function () {
	"use strict";

	var canvas = document.getElementById("constellation");
	var identity = document.getElementById("identity");
	var remixButton = document.getElementById("remix");
	var remixStatus = document.getElementById("remix-status");
	var context = canvas.getContext("2d", { alpha: true });
	var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
	var isReducedMotion = motionQuery.matches;
	var seed = 845142;
	var animationFrame = 0;
	var resizeFrame = 0;
	var lastFrameTime = 0;
	var viewport = { width: 0, height: 0, pixelRatio: 1 };
	var orbBodies = [];
	var boundaries = [];
	var identityObstacle = null;
	var remixObstacle = null;
	var mouseConstraint = null;

	var palette = {
		mist: "#DCE6E2",
		ink: "#102D2E",
		signal: "#EF5A3C",
		iris: "#6657D9",
		chalk: "#F7F5EF"
	};

	if (!window.Matter || !context) {
		document.documentElement.classList.add("no-motion");
		remixButton.hidden = true;
		return;
	}

	var Engine = Matter.Engine;
	var Bodies = Matter.Bodies;
	var Body = Matter.Body;
	var Composite = Matter.Composite;
	var Events = Matter.Events;
	var Mouse = Matter.Mouse;
	var MouseConstraint = Matter.MouseConstraint;
	var engine = Engine.create({
		enableSleeping: true,
		positionIterations: 7,
		velocityIterations: 5,
		constraintIterations: 2,
		gravity: { x: 0, y: 0.42, scale: 0.001 }
	});

	function seededRandom() {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		var value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value = value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	}

	function clamp(value, minimum, maximum) {
		return Math.min(Math.max(value, minimum), maximum);
	}

	function sceneMetrics() {
		if (viewport.height <= 540 && viewport.width > viewport.height) {
			return { count: 7, minimumRadius: 12, maximumRadius: 28 };
		}

		if (viewport.width <= 600) {
			return { count: 12, minimumRadius: 18, maximumRadius: 47 };
		}

		if (viewport.width <= 960) {
			return { count: 14, minimumRadius: 22, maximumRadius: 58 };
		}

		return { count: 18, minimumRadius: 26, maximumRadius: 76 };
	}

	function elementRect(element, padding) {
		var rect = element.getBoundingClientRect();

		return {
			left: clamp(rect.left - padding, 0, viewport.width),
			top: clamp(rect.top - padding, 0, viewport.height),
			right: clamp(rect.right + padding, 0, viewport.width),
			bottom: clamp(rect.bottom + padding, 0, viewport.height)
		};
	}

	function identityRect() {
		return elementRect(identity, viewport.width <= 700 ? 20 : 34);
	}

	function remixRect() {
		return elementRect(remixButton, 14);
	}

	function isOutsideProtectedArea(x, y, radius, rect) {
		return (
			x + radius < rect.left ||
			x - radius > rect.right ||
			y + radius < rect.top ||
			y - radius > rect.bottom
		);
	}

	function findSpawnPoint(radius, identitySafeZone, remixSafeZone) {
		var margin = radius + 8;
		var x = margin;
		var y = margin;

		for (var attempt = 0; attempt < 96; attempt += 1) {
			x = margin + seededRandom() * Math.max(1, viewport.width - margin * 2);
			y = margin + seededRandom() * Math.max(1, viewport.height - margin * 2);

			if (
				isOutsideProtectedArea(x, y, radius + 10, identitySafeZone) &&
				isOutsideProtectedArea(x, y, radius + 10, remixSafeZone)
			) {
				break;
			}
		}

		return { x: x, y: y };
	}

	function createBoundaries() {
		var thickness = 120;
		var common = {
			isStatic: true,
			render: { visible: false },
			label: "boundary"
		};

		boundaries = [
			Bodies.rectangle(viewport.width / 2, -thickness / 2, viewport.width + thickness * 2, thickness, common),
			Bodies.rectangle(viewport.width / 2, viewport.height + thickness / 2, viewport.width + thickness * 2, thickness, common),
			Bodies.rectangle(-thickness / 2, viewport.height / 2, thickness, viewport.height + thickness * 2, common),
			Bodies.rectangle(viewport.width + thickness / 2, viewport.height / 2, thickness, viewport.height + thickness * 2, common)
		];

		Composite.add(engine.world, boundaries);
	}

	function createObstacle(rect, label) {
		var width = Math.max(1, rect.right - rect.left);
		var height = Math.max(1, rect.bottom - rect.top);

		return Bodies.rectangle(
			rect.left + width / 2,
			rect.top + height / 2,
			width,
			height,
			{
				isStatic: true,
				render: { visible: false },
				label: label
			}
		);
	}

	function createOrbs() {
		var metrics = sceneMetrics();
		var identitySafeZone = identityRect();
		var remixSafeZone = remixRect();
		var colorPairs = [
			[palette.signal, palette.chalk, palette.ink],
			[palette.iris, palette.chalk, palette.ink],
			[palette.ink, palette.mist, palette.signal],
			[palette.chalk, palette.ink, palette.iris],
			[palette.signal, palette.ink, palette.chalk]
		];

		for (var index = 0; index < metrics.count; index += 1) {
			var radius = metrics.minimumRadius + seededRandom() * (metrics.maximumRadius - metrics.minimumRadius);
			var point = findSpawnPoint(radius, identitySafeZone, remixSafeZone);
			var body = Bodies.circle(point.x, point.y, radius, {
				density: 0.0012,
				friction: 0.05,
				frictionAir: 0.022,
				restitution: 0.72,
				render: { visible: false },
				label: "orb"
			});

			body.plugin.constellation = {
				pattern: index % 5,
				colors: colorPairs[index % colorPairs.length]
			};

			if (!isReducedMotion) {
				Body.setVelocity(body, {
					x: (seededRandom() - 0.5) * 2.6,
					y: (seededRandom() - 0.5) * 1.8
				});
				Body.setAngularVelocity(body, (seededRandom() - 0.5) * 0.035);
			}

			orbBodies.push(body);
		}

		Composite.add(engine.world, orbBodies);
	}

	function drawConcentricOrb(radius, colors) {
		for (var ring = 0; ring < 4; ring += 1) {
			context.beginPath();
			context.arc(0, 0, radius * (1 - ring * 0.22), 0, Math.PI * 2);
			context.fillStyle = colors[ring % colors.length];
			context.fill();
		}
	}

	function drawTargetOrb(radius, colors) {
		context.fillStyle = colors[0];
		context.beginPath();
		context.arc(0, 0, radius, 0, Math.PI * 2);
		context.fill();

		context.lineWidth = Math.max(3, radius * 0.08);
		context.strokeStyle = colors[1];
		for (var ring = 0.58; ring >= 0.22; ring -= 0.18) {
			context.beginPath();
			context.arc(0, 0, radius * ring, 0, Math.PI * 2);
			context.stroke();
		}
	}

	function drawOffsetOrb(radius, colors) {
		context.fillStyle = colors[0];
		context.beginPath();
		context.arc(0, 0, radius, 0, Math.PI * 2);
		context.fill();

		context.fillStyle = colors[1];
		context.beginPath();
		context.arc(radius * 0.22, -radius * 0.18, radius * 0.42, 0, Math.PI * 2);
		context.fill();

		context.fillStyle = colors[2];
		context.beginPath();
		context.arc(radius * 0.22, -radius * 0.18, radius * 0.13, 0, Math.PI * 2);
		context.fill();
	}

	function drawSplitOrb(radius, colors) {
		context.fillStyle = colors[0];
		context.beginPath();
		context.arc(0, 0, radius, 0, Math.PI * 2);
		context.fill();

		context.fillStyle = colors[1];
		context.beginPath();
		context.arc(0, 0, radius * 0.64, Math.PI * -0.5, Math.PI * 0.5);
		context.lineTo(0, -radius * 0.64);
		context.fill();

		context.fillStyle = colors[2];
		context.beginPath();
		context.arc(0, 0, radius * 0.17, 0, Math.PI * 2);
		context.fill();
	}

	function drawOrbitOrb(radius, colors) {
		context.fillStyle = colors[0];
		context.beginPath();
		context.arc(0, 0, radius, 0, Math.PI * 2);
		context.fill();

		context.strokeStyle = colors[1];
		context.lineWidth = Math.max(2, radius * 0.07);
		context.beginPath();
		context.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
		context.stroke();

		context.fillStyle = colors[2];
		context.beginPath();
		context.arc(radius * 0.58, 0, radius * 0.13, 0, Math.PI * 2);
		context.fill();
	}

	function drawOrb(body) {
		var visual = body.plugin.constellation;
		var radius = body.circleRadius;

		context.save();
		context.translate(body.position.x, body.position.y);
		context.rotate(body.angle);

		switch (visual.pattern) {
			case 0:
				drawConcentricOrb(radius, visual.colors);
				break;
			case 1:
				drawTargetOrb(radius, visual.colors);
				break;
			case 2:
				drawOffsetOrb(radius, visual.colors);
				break;
			case 3:
				drawSplitOrb(radius, visual.colors);
				break;
			default:
				drawOrbitOrb(radius, visual.colors);
		}

		context.restore();
	}

	function renderScene() {
		context.setTransform(viewport.pixelRatio, 0, 0, viewport.pixelRatio, 0, 0);
		context.clearRect(0, 0, viewport.width, viewport.height);

		for (var index = 0; index < orbBodies.length; index += 1) {
			drawOrb(orbBodies[index]);
		}
	}

	function stopAnimation() {
		if (animationFrame) {
			window.cancelAnimationFrame(animationFrame);
			animationFrame = 0;
		}
	}

	function animate(time) {
		if (document.hidden || isReducedMotion) {
			stopAnimation();
			return;
		}

		var elapsed = lastFrameTime ? time - lastFrameTime : 1000 / 60;
		lastFrameTime = time;
		Engine.update(engine, clamp(elapsed, 1000 / 120, 1000 / 60));
		renderScene();

		if (orbBodies.length && orbBodies.every(function (body) { return body.isSleeping; })) {
			stopAnimation();
			return;
		}

		animationFrame = window.requestAnimationFrame(animate);
	}

	function startAnimation() {
		if (animationFrame || document.hidden || isReducedMotion) {
			return;
		}

		lastFrameTime = 0;
		animationFrame = window.requestAnimationFrame(animate);
	}

	function removeBodies(bodies) {
		for (var index = 0; index < bodies.length; index += 1) {
			Composite.remove(engine.world, bodies[index]);
		}
	}

	function removeSceneBodies() {
		removeBodies(orbBodies);
		removeBodies(boundaries);

		if (identityObstacle) {
			Composite.remove(engine.world, identityObstacle);
		}

		if (remixObstacle) {
			Composite.remove(engine.world, remixObstacle);
		}

		orbBodies = [];
		boundaries = [];
		identityObstacle = null;
		remixObstacle = null;
	}

	function rebuildScene() {
		removeSceneBodies();
		createBoundaries();
		identityObstacle = createObstacle(identityRect(), "identity-obstacle");
		remixObstacle = createObstacle(remixRect(), "remix-obstacle");
		Composite.add(engine.world, [identityObstacle, remixObstacle]);
		createOrbs();
		renderScene();
		startAnimation();
	}

	function syncViewport() {
		resizeFrame = 0;
		viewport.width = window.innerWidth;
		viewport.height = window.innerHeight;
		viewport.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

		canvas.width = Math.round(viewport.width * viewport.pixelRatio);
		canvas.height = Math.round(viewport.height * viewport.pixelRatio);
		canvas.style.width = viewport.width + "px";
		canvas.style.height = viewport.height + "px";

		if (mouseConstraint) {
			mouseConstraint.mouse.pixelRatio = viewport.pixelRatio;
		}

		rebuildScene();
	}

	function scheduleViewportSync() {
		if (!resizeFrame) {
			resizeFrame = window.requestAnimationFrame(syncViewport);
		}
	}

	function configureMouseConstraint() {
		var mouse = Mouse.create(canvas);
		mouse.pixelRatio = viewport.pixelRatio;
		mouseConstraint = MouseConstraint.create(engine, {
			mouse: mouse,
			constraint: {
				stiffness: 0.18,
				damping: 0.16,
				render: { visible: false }
			}
		});

		Composite.add(engine.world, mouseConstraint);
		Events.on(mouseConstraint, "startdrag", function () {
			document.body.classList.add("is-dragging");
		});
		Events.on(mouseConstraint, "enddrag", function () {
			document.body.classList.remove("is-dragging");
		});
	}

	function handleRemix() {
		seed = (seed + 1009) | 0;
		rebuildScene();
		remixStatus.textContent = "Constellation remixed.";
	}

	function handleVisibilityChange() {
		if (document.hidden) {
			stopAnimation();
		} else {
			startAnimation();
		}
	}

	function handleMotionPreference(event) {
		isReducedMotion = event.matches;
		document.documentElement.classList.toggle("reduced-motion", isReducedMotion);
		stopAnimation();
		rebuildScene();
	}

	document.documentElement.classList.toggle("reduced-motion", isReducedMotion);
	configureMouseConstraint();
	syncViewport();

	remixButton.addEventListener("click", handleRemix);
	canvas.addEventListener("pointerdown", startAnimation, { passive: true });
	document.addEventListener("visibilitychange", handleVisibilityChange);
	window.addEventListener("resize", scheduleViewportSync, { passive: true });
	new ResizeObserver(scheduleViewportSync).observe(identity);

	if (motionQuery.addEventListener) {
		motionQuery.addEventListener("change", handleMotionPreference);
	} else {
		motionQuery.addListener(handleMotionPreference);
	}
})();
