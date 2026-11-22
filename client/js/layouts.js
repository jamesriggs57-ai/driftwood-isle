/* =====================================================================
   ISLAND LAYOUTS: where buildings, residents and hills go.
   'classic' is the original island (spread out) and must never change, because existing saves
   (trees, rocks, felled stumps) are keyed to it. New layouts can be added freely.
   Coordinates: +x is east (screen right), +z is toward the camera (screen down). Doors face +z.
   The river, pond and dock are shared by every layout.
   ===================================================================== */

export const LAYOUTS = {
  classic: {
    name: 'Spread out',
    blurb: 'Neighbors live all over the island, some across the river. Lots of walking and room to explore.',
    places: { plaza:[0,0], board:[-4,-3.5], shop:[11,-6], home:[-14,9], museum:[3,-18], aquarium:[20,-15], garden:[-12,-5] },
    lot: { x:-14, z:8.5 },
    homes: null,   // residents keep the homes in content.js
    mounds: [ [-36,-16,1.0,20], [-22,28,2.4,18], [20,32,2.0,15], [30,-24,2.0,15], [-4,16,1.3,13], [8,-26,1.1,10] ],
  },
  village: {
    name: 'Village',
    blurb: 'Everyone lives close together around the plaza. Cozy and quick to get around.',
    places: { plaza:[0,0], board:[-4,-3.5], shop:[9,-5], home:[-12,10], museum:[2,-17], aquarium:[17,-11], garden:[-11,-6] },
    lot: { x:-12, z:9.5 },
    homes: { pippa:[11,10], lumi:[0,15], bramble:[-24,2], otis:[23,0], mabel:[15,-24], juniper:[-24,16], clover:[22,13] },
    mounds: [ [-30,30,2.2,16], [26,-30,2.0,14], [-34,-12,1.4,14], [8,32,1.6,12] ],
  },
  highlands: {
    name: 'Highlands',
    blurb: 'A hilly town on terraces. Tall cliffs on the west side, a wide sandy beach on the east.',
    places: { plaza:[0,0], board:[-4,-3.5], shop:[9,-5], home:[-13,9], museum:[2,-17], aquarium:[17,-11], garden:[-11,-6] },
    lot: { x:-13, z:8.5 },
    homes: { pippa:[11,10], lumi:[0,16], bramble:[-25,0], otis:[22,-1], mabel:[14,-25], juniper:[-25,15], clover:[20,13] },
    mounds: [ [-30,8,2.2,22], [-14,26,2.2,16], [-30,-16,1.4,14], [4,30,1.8,12], [20,-28,1.6,12], [0,4,1.0,16] ],
    cliff: { west:true },   // tall cliff coast on the west, wide beach on the east
  },
};

export const GUEST_LAYOUTS = ['village', 'classic', 'highlands'];
