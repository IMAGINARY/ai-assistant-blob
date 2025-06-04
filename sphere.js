import * as THREE from 'three';

export function createUnitSphereBufferGeometry(levels) {
    const nonIndexedGeometry = new THREE.IcosahedronGeometry(1, 0);
    const indexedGeometry = toIndexed(nonIndexedGeometry, Math.pow(2, -2));
    const subdividedIndexedGeometry = subdivideIndexed(indexedGeometry, levels);
    return subdividedIndexedGeometry;
}

function toIndexed(nonIndexedBufferGeometry, eps) {
    if(nonIndexedBufferGeometry.getIndex() !== null)
        throw new Error("The BufferGeometry must not be indexed.");

    const vertices = [];
    const indices = [];
    const p = nonIndexedBufferGeometry.getAttribute('position');
    for( let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);

        // search for duplicates with epsilon
        // if found, use the existing index
        // if not found, add the vertex and index
        let index = -1;
        for(let j = 0; j < vertices.length / 3; j++) {
            const vx = vertices[j * 3];
            const vy = vertices[j * 3 + 1];
            const vz = vertices[j * 3 + 2];

            if((x-vx) ** 2 + (y - vy) ** 2 + (z - vz) ** 2 < eps * eps && i !== j) {
                index = j;
                break;
            }
        }

        if(index === -1) {
            index = vertices.length / 3;
            vertices.push(x, y, z);
        }

        indices.push(index);
    }

    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setIndex(indices);
    newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    return newGeometry;
}

function subdivideIndexed(indexedGeometry, levels) {
    if(indexedGeometry.index === null)
        throw new Error("The BufferGeometry must be indexed.");

    // Create buffers large enough to contain the final result
    const positionAttribute = indexedGeometry.getAttribute('position');
    const vertices = new Float32Array(positionAttribute.array.length * (4 ** levels));
    vertices.set(positionAttribute.array, 0);
    let verticesLength = indexedGeometry.attributes.position.array.length;
    const indices = new Int32Array(indexedGeometry.index.array.length * (4 ** levels));
    indices.set(indexedGeometry.index.array, 0);
    let indicesLength = indexedGeometry.index.array.length;

    // Create and init a map for mapping vertices to indices
    const map = new Map();
    indices.forEach(i => map.set(vertexKey(vertices[i * 3 + 0], vertices[i * 3 + 1], vertices[i * 3 + 2]), i));

    // Iterate the subdivision
    for(let i = 0; i < levels; i++) {
        const result = subdivideIndexedOnce(vertices, verticesLength, indices, indicesLength, map);
        verticesLength = result.verticesLength;
        indicesLength = result.indicesLength;
    }

    const newIndexedGeometry = new THREE.BufferGeometry();
    newIndexedGeometry.setIndex([...indices.subarray(0, indicesLength)]);
    newIndexedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.subarray(0, verticesLength), 3));

    return newIndexedGeometry;
}

function subdivideIndexedOnce(vertices, verticesLength, indices, indicesLength, map) {
    const oldIndicesLength = indicesLength;
    for(let j = 0; j < oldIndicesLength; j += 3) {
        // Retrieve the three vertices for the current triangle
        const i0 = indices[j + 0];
        const x0 = vertices[i0 * 3 + 0];
        const y0 = vertices[i0 * 3 + 1];
        const z0 = vertices[i0 * 3 + 2];

        const i1 = indices[j + 1];
        const x1 = vertices[i1 * 3 + 0];
        const y1 = vertices[i1 * 3 + 1];
        const z1 = vertices[i1 * 3 + 2];

        const i2 = indices[j + 2];
        const x2 = vertices[i2 * 3 + 0];
        const y2 = vertices[i2 * 3 + 1];
        const z2 = vertices[i2 * 3 + 2];

        // Compute the midpoints of the edges and check if they already exist in the map (adding them if not)
        let cx0 = (x0 + x1) / 2;
        let cy0 = (y0 + y1) / 2;
        let cz0 = (z0 + z1) / 2;
        const cl0 = Math.sqrt(cx0 * cx0 + cy0 * cy0 + cz0 * cz0);
        cx0 = cx0 / cl0;
        cy0 = cy0 / cl0;
        cz0 = cz0 / cl0;
        const key0 = vertexKey(cx0, cy0, cz0);
        let ci0 = map.get(key0);
        if(typeof ci0 === 'undefined') {
            ci0 = verticesLength / 3;
            vertices.set([cx0, cy0, cz0], verticesLength);
            verticesLength += 3;
            map.set(key0, ci0);
        }

        let cx1 = (x1 + x2) / 2;
        let cy1 = (y1 + y2) / 2;
        let cz1 = (z1 + z2) / 2;
        const cl1 = Math.sqrt(cx1 * cx1 + cy1 * cy1 + cz1 * cz1);
        cx1 = cx1 / cl1;
        cy1 = cy1 / cl1;
        cz1 = cz1 / cl1;
        const key1 = vertexKey(cx1, cy1, cz1);
        let ci1 = map.get(key1);
        if(typeof ci1 === 'undefined') {
            ci1 = verticesLength / 3;
            vertices.set([cx1, cy1, cz1], verticesLength);
            verticesLength += 3;
            map.set(key1, ci1);
        }

        let cx2 = (x2 + x0) / 2;
        let cy2 = (y2 + y0) / 2;
        let cz2 = (z2 + z0) / 2;
        const cl2 = Math.sqrt(cx2 * cx2 + cy2 * cy2 + cz2 * cz2);
        cx2 = cx2 / cl2;
        cy2 = cy2 / cl2;
        cz2 = cz2 / cl2;
        const key2 = vertexKey(cx2, cy2, cz2);
        let ci2 = map.get(key2);
        if(typeof ci2 === 'undefined') {
            ci2 = verticesLength / 3;
            vertices.set([cx2, cy2, cz2], verticesLength);
            verticesLength += 3;
            map.set(key2, ci2);
        }

        // Add the new triangles to the new indices array
        // Replace the current triangle (first index doesn't change (i0))
        indices.set([i0, ci0, ci2], j);
        // Add the other new triangles to the end of the indices array
        const faces = [
            ci0, i1, ci1,
            ci0, ci1, ci2,
            ci2, ci1, i2,
        ];
        indices.set(faces, indicesLength);
        indicesLength += 9;
    }

    return {verticesLength, indicesLength};
}

function vertexKey(x, y, z) {
    return `${x},${y},${z}`;
}
