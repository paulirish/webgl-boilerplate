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

function transpose(matrix) {
    var transposed = [];
    for (var i = 0; i < 16; i++) {
        var j = i % 4;
        transposed.push(matrix[(i - j) / 4 + 4 * j]);
    }
    return transposed;
}

var invert = (function () {
    function getColumn(n) {
        return n % 4;
    }

    function getRow(n) {
        return (n - getColumn(n)) / 4;
    }

    function getSign(n) {
        return getRow(n) % 2 === getColumn(n) % 2 ? 1 : -1;
    }

    function getIndices(n) {
        function hasSameRowOrColumn(i) {
            return getColumn(i) === getColumn(n) || getRow(i) === getRow(n);
        }

        var indices = [];
        for (var i = 0; i < 16; i++) {
            if (!hasSameRowOrColumn(i)) {
                indices.push(i);
            }
        }
        return indices;
    }

    var indices = [];
    var sign = [];
    for (var i = 0; i < 16; i++) {
        indices.push(getIndices(i));
        sign.push(getSign(i));
    }

    return function (matrix) {
        function cramer(mat) {
            function cofactors(src, i) {
                function cofactor(j) {
                    return src[i[j[0]]] * src[i[j[1]]] * src[i[j[2]]];
                }

                return cofactor([0, 4, 8]) + cofactor([1, 5, 6]) + cofactor([2, 3, 7]) -
                    cofactor([0, 5, 7]) - cofactor([1, 3, 8]) - cofactor([2, 4, 6]);
            }

            function adjoint(n) {
                return sign[n] * cofactors(src, indices[n]);
            }

            var src = transpose(mat);
            var dst = [];
            for (var i = 0; i < 16; i++) {
                dst.push(adjoint(i));
            }

            var determinant = 0;
            for (i = 0; i < 4; i++) {
                determinant += src[i] * dst[i];
            }

            for (i = 0; i < 16; i++) {
                dst[i] /= determinant;
            }

            return dst;
        }

        return cramer(matrix);
    };
})();

var gl,
    pos, norm,
    currentProgram,
    vertexIndices,
    parameters = {  start_time: new Date().getTime(),
        time: 0,
        screenWidth: 0,
        screenHeight: 0 };

init();
animate();

function init() {
    var vertex_shader = "attribute highp vec3 norm,pos; " +
        'varying highp vec3 l;' +
        'uniform highp mat4 n,m,p;' +
        "void main() {" +
        "  gl_Position = p*m*vec4( pos, 1.0 );" +
        '  l=vec3(0.6,0.6,0.6)+' +
        '  (vec3(0.5,0.5,0.75)*max(dot((n*vec4(norm,1.0)).xyz,vec3(0.85,0.8,0.75)),0.0));' +
        "}";

    var fragment_shader = 'varying highp vec3 l;' +
        "uniform float time;" +
        "uniform vec2 resolution; " +
        "void main( void ) { " +
        "  vec2 position = - 1.0 + 2.0 * gl_FragCoord.xy / resolution.xy; " +
        "  float red = abs( sin( position.x * position.y + time / 5.0 ) ); " +
        "  float green = abs( sin( position.x * position.y + time / 4.0 ) ); " +
        "  float blue = abs( sin( position.x * position.y + time / 3.0 ) ); " +
        "  gl_FragColor = vec4( l, 1.0 );" +
        "}";

    var canvas = document.querySelector('canvas');

    gl = canvas.getContext('experimental-webgl');

    if (!gl) {
        alert("cannot create webgl context");
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(getVertices()), gl.STATIC_DRAW);

    norm = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, norm);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(getNormals()), gl.STATIC_DRAW);

    vertexIndices = getVertexIndices();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);

    currentProgram = createProgram(vertex_shader, fragment_shader);

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    function onWindowResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        parameters.screenWidth = canvas.width;
        parameters.screenHeight = canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
    }

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

    function getNormals() {
        var front = [0, 0, 1];
        var back = [0, 0, -1];
        var top = [0, 1, 0];
        var bottom = [0, -1, 0];
        var right = [1, 0, 0];
        var left = [-1, 0, 0];
        var cube = [front, back, top, bottom, right, left];

        var flat = [];
        for (var i = 0; i < cube.length; i++) {
            for (var j = 0; j < 4; j++) {
                for (var k = 0; k < cube[i].length; k++) {
                    flat.push(cube[i][k]);
                }
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

    var n = transpose(invert(m));
    gl.uniformMatrix4fv(gl.getUniformLocation(currentProgram, 'n'), false, new Float32Array(n));

    gl.uniform1f(gl.getUniformLocation(currentProgram, 'time'), parameters.time / 1000);
    gl.uniform2f(gl.getUniformLocation(currentProgram, 'resolution'), parameters.screenWidth, parameters.screenHeight);

    // Render geometry

    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    var vertex_position = gl.getAttribLocation(currentProgram, 'pos');
    gl.vertexAttribPointer(vertex_position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertex_position);

    gl.bindBuffer(gl.ARRAY_BUFFER, norm);
    var vertex_normal = gl.getAttribLocation(currentProgram, 'norm');
    gl.vertexAttribPointer(vertex_normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertex_normal);

    gl.drawElements(gl.TRIANGLES, vertexIndices.length, gl.UNSIGNED_SHORT, 0);

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
