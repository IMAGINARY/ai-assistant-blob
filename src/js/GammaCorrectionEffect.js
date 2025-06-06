import { Uniform } from "three";
import { BlendFunction, Effect } from "postprocessing";

const fragmentShader = `
uniform float gamma;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = vec4(pow(max(inputColor.xyz, 0.0), vec3(gamma, gamma, gamma)), inputColor.w);
}
`;
/**
 * A gamma correction effect.
 */

export class GammaCorrectionEffect extends Effect {

    /**
     * Constructs a new gamma correction effect.
     *
     * @param {Object} [options] - The options.
     * @param {BlendFunction} [options.blendFunction=BlendFunction.SRC] - The blend function of this effect.
     * @param {Number} [options.gamma=2.0] - The gamma factor.
     */

    constructor({ blendFunction = BlendFunction.SRC, gamma = 2.0 } = {}) {

        super("GammaCorrectionEffect", fragmentShader, {
            blendFunction,
            uniforms: new Map([
                ["gamma", new Uniform(gamma)]
            ])
        });

    }

    /**
     * The gamma factor.
     *
     * @type {Number}
     */
    get gamma() {
        return this.uniforms.get("gamma").value;
    }

    set gamma(value) {
        this.uniforms.get("gamma").value = value;
    }
}