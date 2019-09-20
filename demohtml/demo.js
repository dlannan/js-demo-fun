
window.onload = main;
window.onmousemove = moveMove;

// Vertex Shader
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

//  ShaderToy Fragment Shader
var fragmentShaderText = `
#define AA 2

float smin(in float a, in float b, float k)
{
    float h = max(k-abs(a-b), 0.0);
    return min(a,b)-h*h/(k*4.0);
}

float smax(in float a, in float b, float k)
{
    float h = max(k-abs(a-b), 0.0);
    return max(a,b)+h*h/(k*4.0);
}


float sdGuy(in vec3 pos)
{
   float t = fract(iTime);
   float y = 2.0 * t * (1.0-t);
   vec3 cen = vec3(0.0, y, 0.0);
   float d1 = length(pos-cen)-0.25;
   return d1;
}

float sdRoundBox( vec3 p, vec3 b, float r )
{
  vec3 d = abs(p) - b;
  return length(max(d,0.0)) - r
         + min(max(d.x,max(d.y,d.z)),0.0); // remove this line for an only partially signed sdf 
}

float sdTorus( vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

// return distance to closest surface from pos
float map(in vec3 pos)
{
  vec3 qos = vec3(mod(abs(pos.x), 1.5)-0.75, pos.y, mod(abs(pos.z), 2.0)-1.0);
  float d = sdGuy(qos);
  float d1 = pos.y - (-0.25);
  d = min(d, d1);
  d1 = sdRoundBox(qos + vec3(-0.3, 0.0, 0.0), vec3(0.01, 0.3, 0.3), 0.1);
  d = smin(d,d1, 0.1);
  d1 = sdTorus(qos + vec3(0.0, -0.2, 0.0), vec2(0.3, 0.1));
  d = smin(d,d1, 0.1);
  return d;
}

vec3 calcNormal(in vec3 pos)
{
  vec2 e = vec2(0.0001, 0.0);
  // calculates distance from point epsilon on either point of pos in all axial directions to surface
  return normalize(vec3(map(pos+e.xyy)-map(pos-e.xyy),
                        map(pos+e.yxy)-map(pos-e.yxy),
                        map(pos+e.yyx)-map(pos-e.yyx)));
}

// iteratively move along ray direction by distance to closest surface in scene
float castRay(in vec3 ro, vec3 rd)
{
  float t = 0.0;
  for (int i=0; i<512; i++)
  {
      vec3 pos = ro+(t*rd);
      
      // get closest surface in scene to pos
      float h = map(pos);
      
      // collision if less than 0.001 away from surface
      if (abs(h) < (0.001*t))
          break;
      
      // move by distance to closest surface
      t += h;
      
      // break out if moved more than 20 units
      if (t>20.0)
          break;
  }
    
  // no collision -- return -1
  if (t>20.0)
      t= -1.0;
    
  // return distance travelled along ray direction
  return t;
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  float an = iMouse.x/iResolution.x*6.28;

  vec3 tot = vec3(0.0);
    
  #if AA>1
  for( int m=0; m<AA; m++ )
  for( int n=0; n<AA; n++ )
  {
      // pixel coordinates
      vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
      vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
      #else    
      vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
      #endif
    
  // ray origin (camera)
  vec3 ro = vec3(1.0*sin(an), 0.0, 1.0*cos(an));

  // ray target
  vec3 ta = vec3(0.0,0.0,0.0);
    
  // create axes with y: up, x: right, z: pointing from ro to ta
  // ------------------------------------------------------------
  // ray z-axis 
  vec3 ww = normalize(ta-ro);
  
  // ray x-axis
  vec3 uu = normalize(cross(ww, vec3(0,1,0)));
    
  // ray y-axis
  vec3 vv = normalize(cross(uu, ww));
  // ------------------------------------------------------------
    
  // camera FOV
  float fov = 1.5;
    
  // calculate ray direction
  vec3 rd = normalize(vec3(p.x*uu + p.y*vv + fov*ww));
    
  // skyline from blue to light blue
  vec3 col = vec3(0.35, 0.45, 1.0) - 0.7*rd.y;
    
  // mix skyline with light grey as a function of rd.y
  col = mix(col, vec3(0.7,0.75,0.8), exp(-10.0*rd.y));
    
  // perform raycast
  float t = castRay(ro, rd);
  if (t >0.0)
  {
      // location of surface hit
      vec3 pos = ro + t*rd;
      
      // calculate normal of hit surface
      vec3 nor = calcNormal(pos);
      
      // material colour
      vec3 mate = vec3(0.18);
      
      // direction to sun
      vec3 sun_dir = normalize(vec3(0.8,0.4,0.2));
      
      // sun diffraction
      // - dot product of hit surface's normal with sun direction
      float sun_dif = clamp(dot(nor,sun_dir), 0.0, 1.0);
      
      // sun shadow if ray cast from pos+small normal in sun direction hits something
      // - step will return 0.0 if result <= 0 else 1.0
      float sun_shad = step(castRay(pos + nor*0.001, sun_dir), 0.0);
      
      // sky diffraction
      // - dot product of hit surface's normal with direction of sky
      float sky_dif = clamp(0.5 + 0.5*dot(nor, vec3(0.0,1.0,0.0)), 0.0, 1.0);
      
      // ground diffraction
      float bounce_dif = clamp(0.5 - 0.5*dot(nor, vec3(0.0,1.0,0.0)), 0.0, 1.0);

      // colourise shadows
//          col = mate * sun_dif * vec3(9.0, 6.0, 3.0) * vec3(sun_shad, sun_shad*sun_shad, sun_shad*sun_shad);
      
      // material colour * sun colour * sun diffraction * sun shadow
      col = mate * vec3(7.0, 4.5, 3.0) * sun_dif * sun_shad;
      
      // material colour * sky colour * sky diffraction
      col += mate * vec3(0.5, 0.8, 0.9) * sky_dif;
      
      // material colour * ground colour * ground diffraction
      col += mate * vec3(0.7, 0.3, 0.2) * bounce_dif;

      // fog
      col = mix( col, vec3(0.7,0.7,0.7), 1.0-exp(-0.001*t*t*t));
  }
  // some kind of colour correction
  col = pow(col, vec3(0.4545));

  // clamp sun
  col = clamp(1.0*col, 0.0, 1.0);

  // contrast
  col = col*col*(3.0-2.0*col);
  tot += col;
  #if AA>1
  }
  tot /= float(AA*AA);
  #endif
    
  // Output to screen
  fragColor = vec4( tot, 1.0 );
}`;

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

	document.body.scrollTop = 0; // pull the page back up to the top
	document.body.style.overflow = 'hidden'; // relevant addition	

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
