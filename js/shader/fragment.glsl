varying vec2 vUv;
varying float vNoise;

uniform sampler2D oceanTexture;
uniform float time;


void main()	{
	// vec2 newUV = (vUv - vec2(0.5))*resolution.zw + vec2(0.5);
	vec3 color1 = vec3(1., 0., 0.); // red
	vec3 color2 = vec3(1., 1., 1.); 
	vec3 finalColor = mix(color1, color2, 0.5 * (vNoise + 1.));

	vec2 newUV = vUv;

	// float noise = cnoise(vec3(vUv*5., time));
	newUV = vec2(newUV.x, newUV.y + .01 * sin(newUV.x*10. + time));
	// newUV = vec2(newUV.x, newUV.y + .04 * noise);

	vec4 oceanView = texture2D(oceanTexture, newUV);

	gl_FragColor = vec4(finalColor ,1.);
	// gl_FragColor = vec4(vUv, 0. ,1.);
	// gl_FragColor = oceanView + .5 * vec4(vNoise);
	// gl_FragColor = vec4(vNoise);
}
