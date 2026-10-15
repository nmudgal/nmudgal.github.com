(function () {
	"use strict";

	var stage = document.getElementById("kinetic-stage");
	var canvas = document.getElementById("force-field");
	var button = document.getElementById("rebalance");
	var status = document.getElementById("rebalance-status");
	var context = canvas && canvas.getContext("2d", { alpha: true });
	var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
	var reducedMotion = motionQuery.matches;
	var seed = 845142;
	var randomState = seed;
	var viewport = { width: 0, height: 0, ratio: 1 };
	var core = { x: 0, y: 0, radius: 50 };
	var bodies = [];
	var frame = 0;
	var resizeFrame = 0;
	var lastTime = 0;
	var settledFrames = 0;
	var dragged = null;
	var pointer = { x: 0, y: 0, previousX: 0, previousY: 0 };
	var palette = {
		frost: "#E9EFEC",
		carbon: "#132220",
		cobalt: "#3457D5",
		orange: "#FF5A36",
		yellow: "#D7E85C",
		chalk: "#FBFCF8"
	};

	if (!stage || !canvas || !button || !context) {
		document.documentElement.classList.add("no-canvas");
		if (button) button.hidden = true;
		return;
	}

	function clamp(value, minimum, maximum) {
		return Math.min(Math.max(value, minimum), maximum);
	}

	function random() {
		randomState |= 0;
		randomState = (randomState + 0x6d2b79f5) | 0;
		var value = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
		value = value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	}

	function sceneCount() {
		if (viewport.width < 520) return 7;
		if (viewport.width < 900) return 8;
		return 9;
	}

	function scenePadding() {
		return clamp(Math.min(viewport.width, viewport.height) * 0.045, 14, 26);
	}

	function shuffle(values) {
		for (var index = values.length - 1; index > 0; index -= 1) {
			var swapIndex = Math.floor(random() * (index + 1));
			var value = values[index];
			values[index] = values[swapIndex];
			values[swapIndex] = value;
		}
		return values;
	}

	function createScene(previousBodies) {
		var minimum = Math.min(viewport.width, viewport.height);
		var edgePadding = scenePadding();
		var count = sceneCount();
		var minimumRadius = clamp(minimum * 0.038, 12, 22);
		var maximumRadius = clamp(minimum * 0.13, 32, 70);

		randomState = seed;
		var sizeFactors = shuffle([0.76, 1, 0.88, 0.84, 1.08, 1.04, 0.48, 0.64, 0.54, 0.44]);
		var patternOrder = shuffle([1, 0, 2, 3, 4, 5, 1, 3, 0, 4]);
		var arrangementRotation = random() * Math.PI * 2;
		var arrangementDirection = random() < 0.5 ? -1 : 1;
		bodies = [];
		core = {
			x: viewport.width * (viewport.width < 520 ? 0.54 : 0.52),
			y: viewport.height * 0.5,
			radius: clamp(minimum * 0.115, 32, 68)
		};

		for (var index = 0; index < count; index += 1) {
			var angle = arrangementRotation + arrangementDirection * Math.PI * 2 * index / count + (random() - 0.5) * 0.34;
			var radius = clamp(maximumRadius * sizeFactors[index] + (random() - 0.5) * 5, minimumRadius, maximumRadius * 1.08);
			var orbitX = viewport.width * (0.29 + random() * 0.11);
			var orbitY = viewport.height * (0.3 + random() * 0.1);
			var anchorX = clamp(core.x + Math.cos(angle) * orbitX, radius + edgePadding, viewport.width - radius - edgePadding);
			var anchorY = clamp(core.y + Math.sin(angle) * orbitY, radius + edgePadding, viewport.height - radius - edgePadding);
			var spread = reducedMotion ? 0 : minimum * 0.065;
			var previousBody = previousBodies && previousBodies[index];
			var initialX = anchorX + (random() - 0.5) * spread;
			var initialY = anchorY + (random() - 0.5) * spread;

			var body = {
				x: previousBody ? previousBody.x : initialX,
				y: previousBody ? previousBody.y : initialY,
				vx: reducedMotion ? 0 : (random() - 0.5) * 0.8,
				vy: reducedMotion ? 0 : (random() - 0.5) * 0.8,
				anchorX: anchorX,
				anchorY: anchorY,
				radius: radius,
				pattern: patternOrder[index],
				angle: (random() - 0.5) * 0.9
			};
			constrain(body);
			bodies.push(body);
		}
	}

	function constrain(body) {
		var edgePadding = scenePadding();
		var left = body.radius + edgePadding;
		var right = viewport.width - body.radius - edgePadding;
		var top = body.radius + edgePadding;
		var bottom = viewport.height - body.radius - edgePadding;

		if (body.x < left || body.x > right) {
			body.x = clamp(body.x, left, right);
			body.vx *= -0.42;
		}
		if (body.y < top || body.y > bottom) {
			body.y = clamp(body.y, top, bottom);
			body.vy *= -0.42;
		}
	}

	function repel(first, second, minimumDistance, strength) {
		var differenceX = second.x - first.x;
		var differenceY = second.y - first.y;
		var distance = Math.sqrt(differenceX * differenceX + differenceY * differenceY) || 0.01;
		if (distance >= minimumDistance) return;

		var force = (minimumDistance - distance) * strength;
		var normalX = differenceX / distance;
		var normalY = differenceY / distance;
		first.vx -= normalX * force;
		first.vy -= normalY * force;
		second.vx += normalX * force;
		second.vy += normalY * force;
	}

	function update(delta) {
		var energy = 0;
		var index;

		for (index = 0; index < bodies.length; index += 1) {
			var body = bodies[index];
			if (body === dragged) continue;
			body.vx += (body.anchorX - body.x) * 0.0017 * delta;
			body.vy += (body.anchorY - body.y) * 0.0017 * delta;

			var coreX = body.x - core.x;
			var coreY = body.y - core.y;
			var coreDistance = Math.sqrt(coreX * coreX + coreY * coreY) || 0.01;
			var coreMinimum = core.radius + body.radius + 13;
			if (coreDistance < coreMinimum) {
				var coreForce = (coreMinimum - coreDistance) * 0.014 * delta;
				body.vx += coreX / coreDistance * coreForce;
				body.vy += coreY / coreDistance * coreForce;
			}
		}

		for (index = 0; index < bodies.length; index += 1) {
			for (var comparison = index + 1; comparison < bodies.length; comparison += 1) {
				repel(bodies[index], bodies[comparison], bodies[index].radius + bodies[comparison].radius + 9, 0.018 * delta);
			}
		}

		for (index = 0; index < bodies.length; index += 1) {
			var moving = bodies[index];
			if (moving === dragged) {
				moving.x = pointer.x;
				moving.y = pointer.y;
				constrain(moving);
				continue;
			}
			moving.vx *= Math.pow(0.91, delta);
			moving.vy *= Math.pow(0.91, delta);
			var speed = Math.sqrt(moving.vx * moving.vx + moving.vy * moving.vy);
			if (speed > 5.2) {
				moving.vx = moving.vx / speed * 5.2;
				moving.vy = moving.vy / speed * 5.2;
			}
			moving.x += moving.vx * delta;
			moving.y += moving.vy * delta;
			constrain(moving);
			energy += Math.abs(moving.vx) + Math.abs(moving.vy);
		}

		settledFrames = !dragged && energy < 0.12 ? settledFrames + 1 : 0;
	}

	function circle(radius) {
		context.beginPath();
		context.arc(0, 0, radius, 0, Math.PI * 2);
	}

	function drawTechnicalField() {
		var minimum = Math.min(viewport.width, viewport.height);
		var outerRadius = Math.min(viewport.width * 0.6, viewport.height * 0.46);
		var orbitRadii = [core.radius * 1.22, core.radius * 1.62, minimum * 0.28, minimum * 0.39, minimum * 0.52, outerRadius];

		context.save();
		context.translate(core.x, core.y);
		context.lineWidth = 1;
		context.strokeStyle = "rgba(19, 34, 32, 0.34)";

		for (var spoke = 0; spoke < 8; spoke += 1) {
			var spokeAngle = Math.PI * 2 * spoke / 8;
			context.beginPath();
			context.moveTo(Math.cos(spokeAngle) * core.radius * 1.08, Math.sin(spokeAngle) * core.radius * 1.08);
			context.lineTo(Math.cos(spokeAngle) * outerRadius, Math.sin(spokeAngle) * outerRadius);
			context.stroke();
		}

		for (var ringIndex = 0; ringIndex < orbitRadii.length; ringIndex += 1) {
			context.setLineDash(ringIndex % 2 ? [5, 6] : []);
			context.strokeStyle = ringIndex < 2 ? "rgba(19, 34, 32, 0.27)" : "rgba(19, 34, 32, 0.52)";
			context.beginPath();
			context.arc(0, 0, orbitRadii[ringIndex], 0, Math.PI * 2);
			context.stroke();
		}

		context.setLineDash([]);
		for (var markerIndex = 0; markerIndex < 16; markerIndex += 1) {
			var markerAngle = -Math.PI / 2 + Math.PI * 2 * markerIndex / 16;
			var markerRadius = orbitRadii[2 + markerIndex % 4];
			var markerX = Math.cos(markerAngle) * markerRadius;
			var markerY = Math.sin(markerAngle) * markerRadius;
			context.fillStyle = [palette.carbon, palette.cobalt, palette.orange, palette.yellow][markerIndex % 4];
			if (markerIndex % 3 === 0) {
				context.fillRect(markerX - 4, markerY - 4, 8, 8);
			} else {
				context.beginPath();
				context.arc(markerX, markerY, markerIndex % 4 === 0 ? 4 : 3, 0, Math.PI * 2);
				context.fill();
			}
		}

		context.fillStyle = palette.carbon;
		for (var tick = -3; tick <= 3; tick += 1) {
			if (tick === 0) continue;
			var tickPosition = outerRadius * tick / 3;
			context.fillRect(tickPosition - 2, -2, 4, 4);
			context.fillRect(-2, tickPosition - 2, 4, 4);
		}
		context.restore();

		context.save();
		context.strokeStyle = "rgba(19, 34, 32, 0.18)";
		context.setLineDash([2, 3]);
		context.beginPath();
		context.moveTo(18, 0);
		context.lineTo(18, viewport.height);
		context.moveTo(viewport.width - 18, 0);
		context.lineTo(viewport.width - 18, viewport.height);
		context.stroke();
		context.setLineDash([]);
		for (var edgeY = viewport.height * 0.1; edgeY < viewport.height; edgeY += viewport.height * 0.2) {
			context.beginPath();
			context.moveTo(11, edgeY);
			context.lineTo(25, edgeY);
			context.moveTo(viewport.width - 25, edgeY);
			context.lineTo(viewport.width - 11, edgeY);
			context.stroke();
		}
		context.restore();
	}

	function drawConnectors() {
		context.save();
		context.lineWidth = 0.8;
		for (var index = 0; index < bodies.length; index += 1) {
			if (index % 3 === 1) continue;
			context.strokeStyle = index % 2 ? "rgba(19, 34, 32, 0.28)" : "rgba(19, 34, 32, 0.42)";
			context.setLineDash(index % 2 ? [4, 7] : []);
			context.beginPath();
			context.moveTo(core.x, core.y);
			context.lineTo(bodies[index].x, bodies[index].y);
			context.stroke();
		}
		context.restore();
	}

	function drawBody(body) {
		var radius = body.radius;
		context.save();
		context.translate(body.x, body.y);
		context.rotate(body.angle);
		circle(radius);
		context.clip();
		context.fillStyle = [palette.orange, palette.yellow, palette.chalk, palette.chalk, palette.chalk, palette.orange][body.pattern];
		context.fillRect(-radius, -radius, radius * 2, radius * 2);
		context.lineWidth = Math.max(1.2, radius * 0.04);
		context.strokeStyle = palette.carbon;
		context.fillStyle = palette.carbon;

		if (body.pattern === 0) {
			context.strokeStyle = palette.chalk;
			for (var stripe = -radius * 2; stripe <= radius * 2; stripe += Math.max(7, radius * 0.2)) {
				context.beginPath();
				context.moveTo(stripe, -radius);
				context.lineTo(stripe + radius * 1.5, radius);
				context.stroke();
			}
		} else if (body.pattern === 1) {
			context.lineWidth = 0.8;
			for (var gridLine = -radius; gridLine <= radius; gridLine += Math.max(11, radius * 0.33)) {
				context.beginPath();
				context.moveTo(gridLine, -radius);
				context.lineTo(gridLine, radius);
				context.moveTo(-radius, gridLine);
				context.lineTo(radius, gridLine);
				context.stroke();
			}
		} else if (body.pattern === 2) {
			context.lineWidth = 1.2;
			for (var waveY = -radius; waveY <= radius; waveY += Math.max(7, radius * 0.17)) {
				context.beginPath();
				context.moveTo(-radius, waveY);
				for (var waveX = -radius; waveX < radius; waveX += radius * 0.5) {
					context.quadraticCurveTo(waveX + radius * 0.125, waveY - radius * 0.08, waveX + radius * 0.25, waveY);
					context.quadraticCurveTo(waveX + radius * 0.375, waveY + radius * 0.08, waveX + radius * 0.5, waveY);
				}
				context.stroke();
			}
		} else if (body.pattern === 3) {
			for (var dotX = -radius; dotX <= radius; dotX += radius * 0.42) {
				for (var dotY = -radius; dotY <= radius; dotY += radius * 0.42) {
					context.beginPath();
					context.arc(dotX, dotY, Math.max(1.5, radius * 0.055), 0, Math.PI * 2);
					context.fill();
				}
			}
		} else if (body.pattern === 4) {
			context.fillStyle = palette.cobalt;
			context.fillRect(-radius, -radius, radius, radius * 2);
			context.strokeStyle = palette.cobalt;
			context.lineWidth = 1.3;
			for (var ring = radius * 0.16; ring < radius; ring += radius * 0.12) {
				context.beginPath();
				context.arc(0, 0, ring, -Math.PI / 2, Math.PI / 2);
				context.stroke();
			}
		} else {
			context.strokeStyle = palette.chalk;
			context.lineWidth = 0.9;
			for (var orangeGrid = -radius; orangeGrid <= radius; orangeGrid += Math.max(12, radius * 0.3)) {
				context.beginPath();
				context.moveTo(orangeGrid, -radius);
				context.lineTo(orangeGrid, radius);
				context.moveTo(-radius, orangeGrid);
				context.lineTo(radius, orangeGrid);
				context.stroke();
			}
		}
		context.restore();

		context.save();
		context.translate(body.x, body.y);
		circle(radius - 0.75);
		context.lineWidth = 1.5;
		context.strokeStyle = palette.carbon;
		context.stroke();
		context.restore();
	}

	function render() {
		context.setTransform(viewport.ratio, 0, 0, viewport.ratio, 0, 0);
		context.clearRect(0, 0, viewport.width, viewport.height);

		drawTechnicalField();
		drawConnectors();

		context.save();
		context.translate(core.x, core.y);
		context.strokeStyle = "rgba(19, 34, 32, 0.52)";
		context.lineWidth = 1;
		context.fillStyle = palette.cobalt;
		circle(core.radius);
		context.fill();
		context.strokeStyle = palette.chalk;
		context.lineWidth = 2;
		context.stroke();
		context.fillStyle = palette.carbon;
		context.beginPath();
		context.arc(0, 0, Math.max(3, core.radius * 0.065), 0, Math.PI * 2);
		context.fill();
		context.restore();

		for (var index = 0; index < bodies.length; index += 1) drawBody(bodies[index]);
	}

	function animate(time) {
		frame = 0;
		if (document.hidden || reducedMotion) return;
		var delta = lastTime ? clamp((time - lastTime) / 16.667, 0.45, 1.8) : 1;
		lastTime = time;
		update(delta);
		render();
		if (settledFrames < 100 || dragged) frame = window.requestAnimationFrame(animate);
	}

	function start() {
		if (frame || reducedMotion || document.hidden) return;
		lastTime = 0;
		frame = window.requestAnimationFrame(animate);
	}

	function stop() {
		if (frame) window.cancelAnimationFrame(frame);
		frame = 0;
	}

	function resize() {
		viewport.width = Math.max(1, Math.round(stage.clientWidth));
		viewport.height = Math.max(1, Math.round(stage.clientHeight));
		viewport.ratio = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(viewport.width * viewport.ratio);
		canvas.height = Math.round(viewport.height * viewport.ratio);
		canvas.style.width = viewport.width + "px";
		canvas.style.height = viewport.height + "px";
		createScene();
		settledFrames = 0;
		render();
		start();
		document.documentElement.classList.add("canvas-ready");
	}

	function scheduleResize() {
		if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
		resizeFrame = window.requestAnimationFrame(function () {
			resizeFrame = 0;
			stop();
			resize();
		});
	}

	function pointFromEvent(event) {
		var rectangle = canvas.getBoundingClientRect();
		return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top };
	}

	function bodyAt(point) {
		for (var index = bodies.length - 1; index >= 0; index -= 1) {
			var body = bodies[index];
			var x = point.x - body.x;
			var y = point.y - body.y;
			if (x * x + y * y <= Math.pow(body.radius + 8, 2)) return body;
		}
		return null;
	}

	canvas.addEventListener("pointerdown", function (event) {
		if (reducedMotion) return;
		var point = pointFromEvent(event);
		dragged = bodyAt(point);
		if (!dragged) return;
		pointer.x = pointer.previousX = point.x;
		pointer.y = pointer.previousY = point.y;
		canvas.setPointerCapture(event.pointerId);
		document.body.classList.add("is-dragging");
		settledFrames = 0;
		start();
		event.preventDefault();
	});

	canvas.addEventListener("pointermove", function (event) {
		if (!dragged) return;
		var point = pointFromEvent(event);
		pointer.previousX = pointer.x;
		pointer.previousY = pointer.y;
		pointer.x = point.x;
		pointer.y = point.y;
		dragged.vx = (pointer.x - pointer.previousX) * 0.45;
		dragged.vy = (pointer.y - pointer.previousY) * 0.45;
		event.preventDefault();
	});

	function release(event) {
		if (!dragged) return;
		dragged = null;
		document.body.classList.remove("is-dragging");
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
		start();
	}

	canvas.addEventListener("pointerup", release);
	canvas.addEventListener("pointercancel", release);

	button.addEventListener("click", function () {
		seed += 1009;
		stop();
		createScene(bodies);
		settledFrames = 0;
		render();
		start();
		status.textContent = "System forces rebalanced.";
	});

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) stop();
		else {
			settledFrames = 0;
			start();
		}
	});

	function motionChanged(event) {
		reducedMotion = event.matches;
		document.documentElement.classList.toggle("reduced-motion", reducedMotion);
		stop();
		createScene();
		render();
		if (!reducedMotion) start();
	}

	if (motionQuery.addEventListener) motionQuery.addEventListener("change", motionChanged);
	else motionQuery.addListener(motionChanged);
	document.documentElement.classList.toggle("reduced-motion", reducedMotion);

	if ("ResizeObserver" in window) new ResizeObserver(scheduleResize).observe(stage);
	else window.addEventListener("resize", scheduleResize);
	scheduleResize();
}());
