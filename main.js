/**
 * Provides requestAnimationFrame in a cross browser way.
 * paulirish.com/2011/requestanimationframe-for-smart-animating/
 */
window.requestAnimationFrame = window.requestAnimationFrame || (function () {

    return  window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };

})();

var canvas,
    gl,
    buffer,
    vertex_shader, fragment_shader,
    currentProgram,
    vertex_position,
    vertexIndices,
    parameters = {  start_time: new Date().getTime(),
        time: 0,
        screenWidth: 0,
        screenHeight: 0 };

init();
animate();

function init() {

    vertex_shader = "attribute vec3 position; " +
        'uniform highp mat4 n,m,p;' +
        "void main() { gl_Position = p*m*vec4( position, 1.0 ); }";
    fragment_shader = "uniform float time; uniform vec2 resolution; " +
        "void main( void ) { " +
        "vec2 position = - 1.0 + 2.0 * gl_FragCoord.xy / resolution.xy; " +
        "float red = abs( sin( position.x * position.y + time / 5.0 ) ); " +
        "float green = abs( sin( position.x * position.y + time / 4.0 ) ); " +
        "float blue = abs( sin( position.x * position.y + time / 3.0 ) ); " +
        "gl_FragColor = vec4( red, green, blue, 1.0 ); }";


    canvas = document.querySelector('canvas');


    // Initialise WebGL

    try {

        gl = canvas.getContext('experimental-webgl');

    } catch (error) {
    }

    if (!gl) {

        throw "cannot create webgl context";

    }

    // Create Vertex buffer (2 triangles)

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array(getVertices()),
        gl.STATIC_DRAW);

    vertexIndices = getVertexIndices();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);

    // Create Program
    currentProgram = createProgram(vertex_shader, fragment_shader);

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    function getVertices() {
        var lbf = [-1, -1, 1];
        var rbf = [1, -1, 1];
        var rtf = [1, 1, 1];
        var ltf = [-1, 1, 1];
        var lbb = [-1, -1, -1];
        var rbb = [1, -1, -1];
        var rtb = [1, 1, -1];
        var ltb = [-1, 1, -1];
        var cube = [
            lbf, rbf, rtf, ltf,
            lbb, ltb, rtb, rbb,
            ltb, ltf, rtf, rtb,
            lbb, rbb, rbf, lbf,
            rbb, rtb, rtf, rbf,
            lbb, lbf, ltf, ltb
        ];

        var flat = [];
        for (var i = 0; i < cube.length; i++) {
            for (var j = 0; j < cube[i].length; j++) {
                flat.push(cube[i][j]);
            }
        }
        return flat;
    }

    function getVertexIndices() {
        var face = [ 0, 1, 2, 0, 2, 3 ];
        var flat = [];
        for (var i = 0; i < 6; i++) {
            for (var j = 0; j < face.length; j++) {
                flat.push(4 * i + face[j]);
            }
        }
        return flat;
    }
}

function createProgram(vertex, fragment) {

    var program = gl.createProgram();

    var vs = createShader(vertex, gl.VERTEX_SHADER);
    var fs = createShader('#ifdef GL_ES\nprecision highp float;\n#endif\n\n' + fragment, gl.FRAGMENT_SHADER);

    if (vs === null || fs === null) {
        return null;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {

        alert("ERROR:\n" +
            "VALIDATE_STATUS: " + gl.getProgramParameter(program, gl.VALIDATE_STATUS) + "\n" +
            "ERROR: " + gl.getError() + "\n\n" +
            "- Vertex Shader -\n" + vertex + "\n\n" +
            "- Fragment Shader -\n" + fragment);

        return null;

    }

    return program;

}

function createShader(src, type) {

    var shader = gl.createShader(type);

    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {

        alert(( type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT" ) + " SHADER:\n" + gl.getShaderInfoLog(shader));
        return null;

    }

    return shader;

}

function onWindowResize() {

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    parameters.screenWidth = canvas.width;
    parameters.screenHeight = canvas.height;

    gl.viewport(0, 0, canvas.width, canvas.height);

}

function animate() {

    window.requestAnimationFrame(animate);
    render();

}

function render() {
    if (!currentProgram) {
        return;
    }

    parameters.time = new Date().getTime() - parameters.start_time;

    // Load program into GPU

    gl.useProgram(currentProgram);

    // Set values to program variables

    var p = new Float32Array(makePerspective(45, parameters.screenWidth / parameters.screenHeight, 0.1, 100.0));
    gl.uniformMatrix4fv(gl.getUniformLocation(currentProgram, 'p'), false, p);

    var m = mvRotate(Math.PI * ((new Date()).getTime() % 12000) / 6000);
    gl.uniformMatrix4fv(gl.getUniformLocation(currentProgram, 'm'), false, new Float32Array(m));

    gl.uniform1f(gl.getUniformLocation(currentProgram, 'time'), parameters.time / 1000);
    gl.uniform2f(gl.getUniformLocation(currentProgram, 'resolution'), parameters.screenWidth, parameters.screenHeight);

    // Render geometry

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(vertex_position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertex_position);
    gl.drawElements(gl.TRIANGLES, vertexIndices.length, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(vertex_position);

    function makePerspective(fovy, aspect, znear, zfar) {
        var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
        var ymin = -ymax;
        var xmin = ymin * aspect;
        var xmax = ymax * aspect;

        return makeFrustum(xmin, xmax, ymin, ymax, znear, zfar);
    }

    function makeFrustum(left, right, bot, top, near, far) {
        return [
            2 * near / (right - left), 0, 0, 0,
            0, 2 * near / (top - bot), 0, 0,
            (right + left) / (right - left), (top + bot) / (top - bot), (near + far) / (near - far), -1,
            0, 0, 2 * far * near / (near - far), 0
        ];
    }

    function mvRotate(angle) {
        return multMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -6, 1], rotation(angle));
    }

    function rotation(angle) {
        var axis = [1, 0, 1];
        var mod = Math.sqrt(dotProduct(axis));
        var e0 = axis[0] / mod, e1 = axis[1] / mod, e2 = axis[2] / mod;
        var sn = Math.sin(angle), cs = Math.cos(angle), tn = 1 - cs;

        function pcs(e) {
            return tn * e * e + cs;
        }

        function s(e0, e1, e2) {
            return tn * e0 * e1 + sn * e2;
        }

        return [
            pcs(e0), s(e0, e1, e2), s(e0, e2, -e1), 0,
            s(e0, e1, -e2), pcs(e1), s(e1, e2, e0), 0,
            s(e0, e2, e1), s(e1, e2, -e0), pcs(e2), 0,
            0, 0, 0, 1
        ];
    }

    function dotProduct(vector) {
        var dot = 0;
        for (var i = 0; i < vector.length; i++) {
            dot += vector[i] * vector[i];
        }
        return dot;
    }

    function multMatrix(left, right) {
        function get(target, i, j) {
            return target[i + 4 * j];
        }

        function getSum(left, i, right, j) {
            var sum = 0;
            for (var n = 0; n < 4; n++) {
                sum += get(left, i, n) * get(right, n, j);
            }
            return sum;
        }

        var multiplied = [];
        for (var i = 0; i < 16; i++) {
            multiplied.push(getSum(left, i % 4, right, (i - i % 4) / 4));
        }
        return multiplied;
    }
}
