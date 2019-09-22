
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

//-------------------------------------------------
#define onetwenty    2.094395
//-------------------------------------------------

//note: uniformly distributed, normalized rand, [0;1[
float nrand( vec2 n )
{
	return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
}

//-------------------------------------------------

float opUnion( float d1, float d2 ) {  return min(d1,d2); }

vec4 opElongate( in vec3 p, in vec3 h )
{
    //return vec4( p-clamp(p,-h,h), 0.0 ); // faster, but produces zero in the interior elongated box
    
    vec3 q = abs(p)-h;
    return vec4( max(q,0.0), min(max(q.x,max(q.y,q.z)),0.0) );
}

float sdCappedCylinder( vec3 p, vec2 h )
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
} 

float sdPlane( vec3 p, vec4 n )
{
  // n must be normalized
  return dot(p,n.xyz) + n.w;
}


float opRound( in float p, float rad )
{
    return p - rad;
}    

float sdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return length(max(d,0.0))
         + min(max(d.x,max(d.y,d.z)),0.0); // remove this line for an only partially signed sdf 
}

float elCylinder( in vec3 pos ) {

    vec3 q = pos;  
    vec4 w = opElongate( q, vec3(3,0.0,3) );
    return opRound( w.w+sdCappedCylinder( w.xyz, vec2(0.4,0.02) ), 0.04);
}

float n1rand( vec2 n )
{
	float t = fract( iTime );
	float nrnd0 = nrand( n + 0.07*t );
	return nrnd0;
}

float opRep( in vec3 p, in vec3 c )
{
    vec3 q = mod(p,c)-0.5*c;
    float h = nrand( q.xy );
    vec3 b = vec3(2.5, 0.4 + h, 2.5);
    float d = opUnion(elCylinder( q ) , sdBox(q, b) );
    return d;
}

vec2 map(in vec3 pos)
{
    vec2 o1 = vec2(1e10, 0.0);
    vec2 o2 = vec2(1e10, 0.0);

    // plane
    {
        vec3 q = pos - vec3(-1.0,0.0,1.0);  
        vec4 w = opElongate( q, vec3(0.2,0.0,0.3) );
        o1.x = sdPlane( w.xyz, vec4(0, 1, 0, 0) );
        o1.y = 0.25;
    }

    // many elongated cylinder
    {
        vec3 p = pos - vec3(-1.0,0.0,1.0);  
        vec3 c = vec3(8, 0, 8);
        o2.x = opRep(p, c);
        o2.y = 0.5;
    }

    vec2 res = o2;
    if(o1.x < o2.x) res = o1;
    return res;
 }

 vec3 calcNormal(in vec3 pos)
 {
   vec2 e = vec2(0.0001, 0.0);
   return normalize(vec3(map(pos+e.xyy).x-map(pos-e.xyy).x,
                         map(pos+e.yxy).x-map(pos-e.yxy).x,
                         map(pos+e.yyx).x-map(pos-e.yyx).x));
 }

 vec2 castRay(in vec3 ro, vec3 rd)
 {
    vec2 t = vec2(0.0, 0.0);

    for (int i=0; i<100; i++)
    {
        vec3 pos = ro+(t.x*rd);
        vec2 h = map(pos);
        if (h.x < 0.001) {
           t.y = h.y;
           break;
        }
        t.x += h.x;
        if (t.x>20.0) {
           t.y = 1.0;
           break;
        }
    }
    if (t.x>20.0) {
        t.y = 0.0;
        t.x= -1.0;
    }
    return t;
 }

 // 0->1 is the 'hue'. We use simple rgb triple with 120 deg offset (rainbow).
 vec3 getColor( in float c ) {
    vec3 rgb = vec3(0, 0, 0);
    float cv = c * onetwenty;
    rgb.r = sin(cv);
    rgb.g = sin(cv + onetwenty);
    rgb.b = sin(cv + onetwenty + onetwenty);
    return rgb;
 }

 void mainImage( out vec4 fragColor, in vec2 fragCoord )
 {
   vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
   float an = iMouse.x/iResolution.x*6.28;

   //vec3 ro = vec3(1.0*sin(an), 0.0, 1.0*cos(an));

   vec3 ro = vec3(0.0,3.0,6.0);
   vec3 rd = normalize(vec3(p-vec2(0.0,1.0),-2.0));

   vec3 ta = vec3(0.0,0.0,0.0);
   vec3 ww = normalize(ta-ro);
   vec3 uu = normalize(cross(ww, vec3(0,1,0)));
   vec3 vv = normalize(cross(uu, ww));
   //vec3 rd = normalize(vec3(p.x * uu + p.y*vv +1.5*ww));

   vec3 col = vec3(0.35, 0.45, 1.0) - 0.7*rd.y;
   col = mix(col, vec3(0.7,0.75,0.8), exp(-10.0*rd.y));

   vec2 t = castRay(ro, rd);

   if (t.x >0.0)
   {
       vec3 pos = ro + t.x*rd;
       vec3 nor = calcNormal(pos);
       vec3 mate = vec3(0.18);
       vec3 sun_dir = normalize(vec3(0.8,0.4,0.2));
       float sun_dif = clamp(dot(nor,sun_dir), 0.0, 1.0);
       float sun_shad = step(castRay(pos + nor*0.001, sun_dir).x, 0.0);
       float sky_dif = clamp(0.5 + 0.5*dot(nor, vec3(0.0,1.0,0.0)), 0.0, 1.0);
//       float bounce_dif = clamp(0.5 - 0.5*dot(nor, vec3(0.0,1.0,0.0)), 0.0, 1.0);

       col = mate * vec3(7.0, 4.5, 3.0) * sun_dif * sun_shad * getColor(t.y);
       col += mate*vec3(0.5, 0.8, 0.9) * sky_dif;      
//       col += mate*vec3(0.7,0.3, 0.2) * bounce_dif;
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