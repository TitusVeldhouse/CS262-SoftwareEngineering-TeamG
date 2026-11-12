const buildings = [
    {
        id: 1,
        name: "Science Building",
        isParkingLot: false,
        floors: [
            {level: 0, rooms: ["SB 001", "SB 002", "SB 003"]},
            {level: 1, rooms: ["SB 101", "SB 102", "SB 103"]},
            {level: 2, rooms: ["SB 201", "SB 202", "SB 203"]},
            {level: 3, rooms: ["SB 301", "SB 302", "SB 303"]}
        ],
    },
    {
        id: 2,
        name: "Hekman Library",
        isParkingLot: false,
        floors: [
            {level: 1, rooms: ["HL 101", "HL 102", "HL 103"]},
            {level: 2, rooms: ["HL 201", "HL 202", "HL 203"]},
            {level: 3, rooms: ["HL 301", "HL 302", "HL 303"]},
            {level: 4, rooms: ["HL 401", "HL 402", "HL 403"]}
        ]
    }
];
const pointsOfInterest = [
    {id: 1, type: 'restroom', buildingId: 1, floor: 0, label: 'Restroom'},
    {id: 2, type: 'printer', buildingId: 2, floor: 3, label: 'Printer'},
    {id: 3, type: 'water fountain', buildingId: 1, floor: 2, label: 'Water Fountain'},
    {id: 4, type: 'vending machine', buildingId: 2, floor: 1, label: 'Vending Machine'}
];

module.exports = {buildings, pointsOfInterest};
