import mermaid from 'mermaid';
import { inflate } from 'pako';

const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');
const message = document.getElementById('message');
const zoomLabel = document.getElementById('zoom-label');
let svg = null;
let originalViewBox = null;
let viewBox = null;
let dragging = false;
let pointerX = 0;
let pointerY = 0;

const updateViewBox = () => {
    if (!svg || !viewBox) return;
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    const zoom = originalViewBox.width / viewBox.width;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
};

const clientToSvg = (clientX, clientY) => {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
};

const zoomAt = (factor, clientX, clientY) => {
    if (!svg || !viewBox) return;
    const currentZoom = originalViewBox.width / viewBox.width;
    const nextZoom = Math.min(20, Math.max(0.1, currentZoom * factor));
    const appliedFactor = nextZoom / currentZoom;
    const focus = clientToSvg(clientX, clientY);

    viewBox = {
        x: focus.x - (focus.x - viewBox.x) / appliedFactor,
        y: focus.y - (focus.y - viewBox.y) / appliedFactor,
        width: viewBox.width / appliedFactor,
        height: viewBox.height / appliedFactor
    };
    updateViewBox();
};

const fitToScreen = () => {
    if (!originalViewBox) return;
    viewBox = { ...originalViewBox };
    updateViewBox();
};

const zoomFromCenter = (factor) => {
    zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
};

viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
}, { passive: false });

viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    viewport.classList.add('dragging');
    viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener('pointermove', (event) => {
    if (!dragging || !svg) return;
    const previous = clientToSvg(pointerX, pointerY);
    const current = clientToSvg(event.clientX, event.clientY);
    viewBox.x += previous.x - current.x;
    viewBox.y += previous.y - current.y;
    pointerX = event.clientX;
    pointerY = event.clientY;
    updateViewBox();
});

const stopDragging = () => {
    dragging = false;
    viewport.classList.remove('dragging');
};

viewport.addEventListener('pointerup', stopDragging);
viewport.addEventListener('pointercancel', stopDragging);
document.getElementById('zoom-in').addEventListener('click', () => zoomFromCenter(1.2));
document.getElementById('zoom-out').addEventListener('click', () => zoomFromCenter(1 / 1.2));
document.getElementById('fit').addEventListener('click', fitToScreen);

const decodePayload = () => {
    const prefix = '#pako:';
    if (!window.location.hash.startsWith(prefix)) {
        throw new Error('The diagram URL is invalid.');
    }

    let encoded = window.location.hash.slice(prefix.length)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    encoded += '='.repeat((4 - encoded.length % 4) % 4);

    const binary = atob(encoded);
    const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(inflate(compressed)));
};

const initializeViewer = async () => {
    try {
        const data = decodePayload();
        if (typeof data.source !== 'string' || !data.source.trim()) {
            throw new Error('The diagram source is invalid.');
        }

        const dark = data.theme === 'dark';
        if (dark) {
            document.body.classList.add('dark');
        }

        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: dark ? 'dark' : 'default'
        });
        const result = await mermaid.render('mermaid-viewer-diagram', data.source);
        stage.innerHTML = result.svg;
        if (typeof result.bindFunctions === 'function') {
            result.bindFunctions(stage);
        }

        svg = stage.querySelector('svg');
        if (!svg) {
            throw new Error('The diagram SVG is missing.');
        }

        const values = (svg.getAttribute('viewBox') || '')
            .trim()
            .split(/[\s,]+/)
            .map(Number);
        if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
            const width = svg.width.baseVal.value || svg.getBBox().width;
            const height = svg.height.baseVal.value || svg.getBBox().height;
            values.splice(0, values.length, 0, 0, width, height);
        }

        originalViewBox = {
            x: values[0],
            y: values[1],
            width: values[2],
            height: values[3]
        };
        viewBox = { ...originalViewBox };
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.maxWidth = 'none';
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        message.hidden = true;
        updateViewBox();
    } catch (error) {
        message.textContent = error.message || 'Unable to load the diagram.';
    }
};

initializeViewer();
