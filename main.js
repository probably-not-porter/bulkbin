async function parseDecklist() {
    document.getElementById("output").innerHTML = "";
    document.getElementById("loading").innerText = "";

    const rawText = document.getElementById('deckInput').value;
    const cards = [];
    const lines = rawText.split('\n');

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.toLowerCase().includes('sideboard')) {
            return;
        }
        const match = trimmed.match(/^(SB:)?\s*(\d+)\s+([^\[\n]+)/i);

        if (match) {
            const count = parseInt(match[2], 10);
            const cardName = match[3].trim();
            cards.push({ count, name: cardName });
        }
    });

    var output_data = {};
    var counter = 0;
    const basics = ["Mountain", "Island", "Plains", "Forest", "Swamp"];

    for (const cardObj of cards) {
        counter++;
        document.getElementById("loading").innerText = `Checking Scryfall... (${(counter / cards.length * 100).toFixed(0)}%)`;

        if (!basics.includes(cardObj.name)) {
            const setMap = await getAllSetsForCard(cardObj.name);

            if (setMap) {
                for (const [setName, setData] of Object.entries(setMap)) {
                    if (!output_data[setName]) {
                        output_data[setName] = {
                            icon: setData.iconUrl,
                            cards: {}
                        };
                    }

                    if (!output_data[setName].cards[cardObj.name]) {
                        output_data[setName].cards[cardObj.name] = {
                            count: cardObj.count,
                            image: setData.imageUrl
                        };
                    } else {
                        output_data[setName].cards[cardObj.name].count += cardObj.count;
                    }
                }
            }
            await sleep(100);
        }
    }

    document.getElementById("loading").innerText = "Done processing!";

    const sortedByTotalCards = Object.entries(output_data)
        .map(([setName, setData]) => {
            const totalCount = Object.values(setData.cards).reduce((sum, item) => sum + item.count, 0);
            return { setName, icon: setData.icon, totalCount, cards: setData.cards };
        })
        .sort((a, b) => b.totalCount - a.totalCount);

    renderCards(sortedByTotalCards);
}

function renderCards(setlist) {
    let elem = document.getElementById("output");
    let htmlContent = "";

    for (let set of setlist) {
        htmlContent += `<div class="set-row">`;
        htmlContent += `  <div class="set-title-container">`;
        if (set.icon) {
            htmlContent += `    <img class="set-icon" src="${set.icon}" alt="${set.setName} icon">`;
        }
        htmlContent += `    <h3>${set.setName} (${set.totalCount} cards)</h3>`;
        htmlContent += `  </div>`;
        htmlContent += `  <ul class="card-list">`;

        for (const [cardName, cardDetails] of Object.entries(set.cards)) {
            htmlContent += `     <li class="card-item">`;
            htmlContent += `        <span class="count">${cardDetails.count}</span>`;
            if (cardDetails.image) {
                htmlContent += `   <a class="card-link" href="${cardDetails.image}" target="_blank">${cardName}</a>`;
                htmlContent += `   <img class="image-preview" src="${cardDetails.image}" alt="${cardName}">`;
            } else {
                htmlContent += `   <span>${cardName}</span>`;
            }
            htmlContent += `     </li>`;
        }

        htmlContent += `  </ul>`;
        htmlContent += `</div>`;
    }

    elem.innerHTML = htmlContent;
}

async function getAllSetsForCard(cardName) {
    const query = `!"${cardName}"`;
    const printUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints`;

    try {
        const printResponse = await fetch(printUrl);
        if (!printResponse.ok) throw new Error(`Prints fetch failed`);
        const searchData = await printResponse.json();

        const setMap = {};

        searchData.data.forEach(printing => {
            let imageUrl = "";
            if (printing.image_uris && printing.image_uris.normal) {
                imageUrl = printing.image_uris.normal;
            } else if (printing.card_faces && printing.card_faces[0].image_uris) {
                imageUrl = printing.card_faces[0].image_uris.normal;
            }

            if (imageUrl) {
                // Scryfall houses SVGs for every set via their public CDN using the lowercase set code
                const iconUrl = printing.set ? `https://svgs.scryfall.io/sets/${printing.set.toLowerCase()}.svg` : "";

                setMap[printing.set_name] = {
                    imageUrl: imageUrl,
                    iconUrl: iconUrl
                };
            }
        });
        return setMap;
    } catch (error) {
        console.error("Error fetching from Scryfall:", error);
        return null;
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
