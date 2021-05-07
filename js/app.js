import * as THREE from "three";
import imagesLoaded from "imagesloaded";
import gsap from "gsap";
import FontFaceObserver from "fontfaceobserver";
import Scroll from "./scroll";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import fragment from "./shader/fragment.glsl";
import vertex from "./shader/vertex.glsl";

import ocean from "../img/ocean.jpg";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

export default class Sketch {
  constructor(opt) {
    this.time = 0;
    this.dom = opt.dom;

    this.width = this.dom.offsetWidth;
    this.height = this.dom.offsetHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      100,
      2000
    );
    this.camera.position.z = 600;
    this.camera.fov = 2 * Math.atan(this.height / 2 / 600) * (180 / Math.PI); // 3D上とブラウザ上の単位をあわせる

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.dom.appendChild(this.renderer.domElement);

    this.images = [...document.querySelectorAll("img")];

    const fontOpen = new Promise((resolve) => {
      new FontFaceObserver("Open Sans").load().then(resolve);
    });
    const fontPlayfair = new Promise((resolve) => {
      new FontFaceObserver("Playfair Display").load().then(resolve);
    });

    const preloadImages = new Promise((resolve) => {
      imagesLoaded(
        document.querySelectorAll("img"),
        { background: true },
        resolve
      );
    });

    this.currentScroll = 0;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    Promise.all([fontOpen, fontPlayfair, preloadImages]).then(() => {
      this.scroll = new Scroll();
      this.addImages();
      this.setPosition();
      this.mouseMovement();

      this.resize();
      this.setupResize();

      this.composerPass();
      // this.addObjects();
      this.render();
      window.addEventListener("scroll", () => {
        this.currentScroll = scrollY;
        this.setPosition();
      });
    });
  }

  composerPass() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    const counter = 0.0;
    this.myEffect = {
      uniforms: {
        tDiffuse: { value: null },
        scrollSpeed: { value: null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        uniform float scrollSpeed;

        void main() {
          vec2 newUV = vUv;
          float area = smoothstep(0.4, 0., vUv.y);
          area = pow(area, 4.);
          // newUV.x += (vUv.x - .5) * .5 * vUv.y;
          newUV.x -= (vUv.x - .5) * .5 * area * scrollSpeed;
          gl_FragColor = texture2D(tDiffuse, newUV);
          // gl_FragColor = vec4(area, 0., 0., 1.);
        }
      `,
    };

    this.customPass = new ShaderPass(this.myEffect);
    this.customPass.renderToScreen = true;

    this.composer.addPass(this.customPass);
  }

  mouseMovement() {
    window.addEventListener("mousemove", (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // calculate objects intersecting the picking ray
      const intersects = this.raycaster.intersectObjects(this.scene.children);

      for (let i = 0; i < intersects.length; i++) {
        // intersects[i].object.material.color.set(0xff0000);

        const obj = intersects[i].object;
        obj.material.uniforms.hover.value = intersects[0].uv;
      }
    });
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.dom.offsetWidth;
    this.height = this.dom.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  addImages() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uImage: { value: 0 },
        hover: { value: new THREE.Vector2(0.5, 0.5) },
        hoverState: { value: 0 },
        oceanTexture: { value: new THREE.TextureLoader().load(ocean) },
      },
      side: THREE.DoubleSide,
      fragmentShader: fragment,
      vertexShader: vertex,
      //   wireframe: true,
    });

    this.materials = [];

    this.imageStore = this.images.map((img) => {
      const bounds = img.getBoundingClientRect();

      const geometry = new THREE.PlaneBufferGeometry(
        bounds.width,
        bounds.height,
        10,
        10
      );
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;

      // const material = new THREE.MeshBasicMaterial({
      //   // color: 0xff0000,
      //   map: texture,
      // })
      const material = this.material.clone();

      img.addEventListener("mouseenter", () => {
        gsap.to(material.uniforms.hoverState, {
          duration: 1,
          value: 1,
        });
      });

      img.addEventListener("mouseout", () => {
        gsap.to(material.uniforms.hoverState, {
          duration: 1,
          value: 0,
        });
      });

      this.materials.push(material);
      material.uniforms.uImage.value = texture;

      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);

      return {
        img,
        mesh,
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      };
    });
  }

  setPosition() {
    this.imageStore.forEach((o) => {
      o.mesh.position.x = o.left - this.width / 2 + o.width / 2;
      o.mesh.position.y =
        this.currentScroll - o.top + this.height / 2 - o.height / 2;
    });
  }

  addObjects() {
    this.geometry = new THREE.PlaneBufferGeometry(200, 100, 10, 10);
    // this.geometry = new THREE.SphereBufferGeometry(0.4, 100, 100);
    // this.material = new THREE.MeshNormalMaterial();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        oceanTexture: { value: new THREE.TextureLoader().load(ocean) },
      },
      side: THREE.DoubleSide,
      fragmentShader: fragment,
      vertexShader: vertex,
      wireframe: true,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  render() {
    this.time += 0.05;

    this.scroll.render();
    this.currentScroll = this.scroll.scrollToRender;
    this.setPosition();
    this.customPass.uniforms.scrollSpeed.value = this.scroll.speedTarget;

    // this.mesh.rotation.x = this.time / 2000;
    // this.mesh.rotation.y = this.time / 1000;

    // this.material.uniforms.time.value = this.time;

    this.materials.forEach((m) => {
      m.uniforms.time.value = this.time;
    });

    // this.renderer.render(this.scene, this.camera);
    this.composer.render();

    requestAnimationFrame(this.render.bind(this));
  }
}

new Sketch({
  dom: document.getElementById("container"),
});
