
window.onload = main;
window.onmousemove = moveMove;


// <!-- Vertex Shader -->
var vertexShaderText = `
attribute vec2 a_position;
varying vec2 surfacePosition;
uniform vec2 screenRatio;

void main() {
   surfacePosition = a_position*screenRatio;
   gl_Position = vec4(a_position, 0, 1);
}`;

var shaderToyheader = `
    //#extension GL_OES_standard_derivatives : enable
    #ifdef GL_ES
    precision mediump float;
    #endif

    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec4 iMouse;
`;

var shaderToyfooter = `
    void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy); 
    }
`;

//<!-- ShaderToy Fragment Shader! -->
var fragmentShaderText = `
 float sdGuy(in vec3 pos)
 {
    float t = fract(iTime);
    float y = 2.0 * t * (1.0-t);
    vec3 cen = vec3(0.0, y, 0.0);
    float d1 = length(pos-cen)-0.25;
    return d1;
 }
 float map(in vec3 pos)
 {
   float d1 = sdGuy(pos);
   float d2 = pos.y - (-0.25);
   return min(d1,d2);
 }
 vec3 calcNormal(in vec3 pos)
 {
   vec2 e = vec2(0.0001, 0.0);
   return normalize(vec3(map(pos+e.xyy)-map(pos-e.xyy),
                         map(pos+e.yxy)-map(pos-e.yxy),
                         map(pos+e.yyx)-map(pos-e.yyx)));
 }
 float castRay(in vec3 ro, vec3 rd)
 {
   float t = 0.0;
   for (int i=0; i<100; i++)
   {
       vec3 pos = ro+(t*rd);
       float h = map(pos);
       if (h < 0.001)
           break;
       t += h;
       if (t>20.0)
           break;
   }
   if (t>20.0)
       t= -1.0;
   return t;
 }
 void mainImage( out vec4 fragColor, in vec2 fragCoord )
 {
   vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
   float an = iMouse.x/iResolution.x*6.28;
   vec3 ro = vec3(1.0*sin(an), 0.0, 1.0*cos(an));
   vec3 ta = vec3(0.0,0.0,0.0);
   vec3 ww = normalize(ta-ro);
   vec3 uu = normalize(cross(ww, vec3(0,1,0)));
   vec3 vv = normalize(cross(uu, ww));
   vec3 rd = normalize(vec3(p.x * uu + p.y*vv +1.5*ww));
   vec3 col = vec3(0.35, 0.45, 1.0) - 0.7*rd.y;
   col = mix(col, vec3(0.7,0.75,0.8), exp(-10.0*rd.y));
   float t = castRay(ro, rd);
   if (t >0.0)
   {
       vec3 pos = ro + t*rd;
       vec3 nor = calcNormal(pos);
       vec3 mate = vec3(0.18);
       vec3 sun_dir = normalize(vec3(0.8,0.4,0.2));
       float sun_dif = clamp(dot(nor,sun_dir), 0.0, 1.0);
       float sun_shad = step(castRay(pos + nor*0.001, sun_dir), 0.0);
       float sky_dif = clamp(0.5 + 0.5*dot(nor, vec3(0.0,1.0,0.0)), 0.0, 1.0);
       float bounce_dif = clamp(0.5 - 0.5*dot(nor, vec3(0.0,1.0,0.0)), 0.0, 1.0);
       col = mate*vec3(7.0, 4.5, 3.0) * sun_dif * sun_shad;
       col += mate*vec3(0.5, 0.8, 0.9) * sky_dif;
       col += mate*vec3(0.7,0.3, 0.2) * bounce_dif;
   }
   col = pow(col, vec3(0.4545));
   // Output to screen
   fragColor = vec4(col,1.0);
 } `;

var gl;
var time = 0.0;
var timeLocation;
var mouseLocation;
var start = 0.0;
var mouseX = 0.0;
var mouseY = 0.0;

var fps = 0;
var fpstime = 0.0;

var surfacePosition;

function moveMove(e) {
    mouseX = e.pageX;
    mouseY = e.pageY;
}

function getShaderType(id) {
    return document.getElementById(id).type;
}

function getShaderCode(id) {
      var shaderScript = document.getElementById(id);
      if (!shaderScript) {
          return null;
      }

      var str = "";
      var k = shaderScript.firstChild;
      while (k) {
          if (k.nodeType == 3)
              str += k.textContent;
          k = k.nextSibling;
      }
      return str;
}

// Function that grabs a shader stored as a page script
// and compiles it based on the MIME type.
// http://learningwebgl.com/
function compileShader(gl, code, type) {
      var shader;
      if (type == "fragment") {
          shader = gl.createShader(gl.FRAGMENT_SHADER);
      } else if (type == "vertex") {
          shader = gl.createShader(gl.VERTEX_SHADER);
      } else {
          return null;
      }

      gl.shaderSource(shader, code);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          alert(gl.getShaderInfoLog(shader));
          return null;
      }

      return shader;
  }



function main() {

    canvas = document.createElement('canvas');

    canvas.id = "CursorLayer";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.zIndex = 8;
    canvas.style.position = "absolute";
    canvas.style.border = "1px solid";
    canvas.style.top = "0px";
    canvas.style.left = "0px";
    
    
    var body = document.getElementsByTagName("body")[0];
    body.appendChild(canvas);

    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');// 
    canvas.className = "fullscreen";

	document.body.scrollTop = 0; // <-- pull the page back up to the top
	document.body.style.overflow = 'hidden'; // <-- relevant addition	

    if (!gl) {
        alert("OpenGL could not be initialized.");
        return;
    }
            
    gl.getExtension('OES_standard_derivatives'); 

    // Setup GLSL program.
    // Make the shaders.
    // The getShader function runs the compiler.	
    var vertexShader = compileShader(gl,  vertexShaderText, "vertex");

    var fragHeader = shaderToyheader;
    var fragFooter = shaderToyfooter;
    var fragCode = fragHeader + fragmentShaderText + fragFooter;
    //console.log(fragCode);

    var fragmentShader = compileShader(gl, fragCode, "fragment");

    var program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        // An error occurred while linking
        alert("WebGL could not initialize one, or both, shaders.");
        gl.deleteProgram(program);
        return;
    }

    gl.useProgram(program);

    // Look up where the vertex data needs to go.
    var positionLocation = gl.getAttribLocation(program, "a_position");

    // Set the resolution
    var resolutionLocation = gl.getUniformLocation(program, "iResolution");
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

    mouseLocation = gl.getUniformLocation(program, "iMouse");
    gl.uniform4f(mouseLocation, 0.0, 0.0, 0.0, 0.0);

    //surfacePosition = gl.getUniformLocation(program, "surfacePosition");
    //gl.uniform2f(surfacePosition, canvas.width, canvas.height);

    //var temp = gl.getUniformLocation(program, "gl_FragCoord");
    var mx = Math.max(canvas.width, canvas.height);
    var xdivmx = canvas.width/mx; //Coordinates range from [-1,1].
    var ydivmx = canvas.height/mx;
    var screenRatioLocation = gl.getUniformLocation(program, "screenRatio");
    gl.uniform2f(screenRatioLocation, xdivmx, ydivmx);


    timeLocation = gl.getUniformLocation(program, "iTime");  
    gl.uniform1f(timeLocation, time);


    // Create a buffer and put a single clipspace rectangle in
    // it (2 triangles).
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // draw
    //gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Every realtime application needs a frame counter.
    start = Date.now();
    render();
    
}

// Provides requestAnimationFrame in a cross-browser way. Everone uses these. I think they 
// come from the original Khronos source.
window.requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
           return window.setTimeout(callback, 1000/60);
         };
})();

// Provides cancelRequestAnimationFrame in a cross-browser way.
window.cancelRequestAnimFrame = (function() {
  return window.cancelCancelRequestAnimationFrame ||
         window.webkitCancelRequestAnimationFrame ||
         window.mozCancelRequestAnimationFrame ||
         window.oCancelRequestAnimationFrame ||
         window.msCancelRequestAnimationFrame ||
         window.clearTimeout;
})();

 
function render() {

    // Rendering loop for the WebGL canvas.
    var elapsedtime = (Date.now() - start)/1000.0;
    var framespeed = 1.0;
    time += framespeed*elapsedtime;
    gl.uniform1f(timeLocation, time);
    gl.uniform4f(mouseLocation, mouseX, mouseY, 0, 0);

    //gl.clearColor(1.0, 0.0, 0.0, 1.0)
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    fps++;
    fpstime += elapsedtime;
    if(fpstime>=1.0){

        fpstime -= 1.0;
        fps = 0;

    }

    start = Date.now();
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
    window.requestAnimationFrame(render, canvas);
}
