const postName = "residual_magnitude";
function loadAndPlotJSON(plotName) {
    const fileName = `plots/${postName}/${plotName}.json`;
    const plotId = plotName;

    fetch(fileName)
        .then(response => response.json())
        .then(data => {
            console.log(`Data for ${plotName}:`, data);
            Plotly.newPlot(plotId, data.data, data.layout);
        })
        .catch(error => console.error(`Error loading the JSON file for ${plotName}:`, error));
}

for (let i = 1; i <= 3; i++) {
    loadAndPlotJSON(`plot${i}`);
}