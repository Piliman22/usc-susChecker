document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('processButton').addEventListener('click', processFile);
});

function processFile() {
    const fileInput = document.getElementById('musicFile');
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Clear previous results

    if (!fileInput || fileInput.files.length === 0) {
        alert('ファイルを選択してください。');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        const content = event.target.result;

        if (file.name.endsWith('.usc')) {
            processUSCFile(content);
        } else if (file.name.endsWith('.sus')) {
            processSUSFile(content);
        } else {
            resultsDiv.innerHTML = '<p>対応していないファイル形式です。USCまたはSUSファイルをアップロードしてください。</p>';
        }
    };

    reader.readAsText(file);
}

function processUSCFile(content) {
    const resultsDiv = document.getElementById('results');
    let parsedContent;
    try {
        parsedContent = JSON.parse(content);
    } catch (e) {
        resultsDiv.innerHTML = '<p>ファイルの内容を解析できませんでした。ファイルが破損している可能性があります</p>';
        return;
    }

    if (!parsedContent.usc || !Array.isArray(parsedContent.usc.objects)) {
        resultsDiv.innerHTML = '<p>アップロードされたファイルは期待された形式ではありません。</p>';
        return;
    }

    const objects = parsedContent.usc.objects;
    const objectItems = new Map();
    const connectionItems = new Map();
    let objectDuplicates = [];
    let connectionDuplicates = [];

    objects.forEach(entry => {
        if (entry.type === "single") {
            const key = `${entry.beat}-${entry.lane}-${entry.size}`;
            if (!objectItems.has(key)) {
                objectItems.set(key, []);
            }
            if (entry.type !== 'ダメージ') {
                objectItems.get(key).push(entry);
            }
        }

        if (entry.type === "slide" && entry.connections) {
            entry.connections.forEach(connection => {
                const key = `${connection.beat}-${connection.lane}-${connection.size}`;
                if (!connectionItems.has(key)) {
                    connectionItems.set(key, []);
                }
                connectionItems.get(key).push({ connection });
            });
        }
    });

    // ノーツの重複チェック
    objectItems.forEach((value, key) => {
        if (value.length > 1) {
            objectDuplicates.push({
                key: key,
                entries: value,
                measures: value.map(entry => Math.floor(entry.beat / 4))
            });
        }
    });

    // スライドの重複チェック
    connectionItems.forEach((value, key) => {
        if (value.length > 1) {
            const entries = value.filter(entry => {
                const conn = entry.connection;
                return conn.beat === value[0].connection.beat &&
                       conn.lane === value[0].connection.lane &&
                       conn.size === value[0].connection.size;
            });

            if (entries.length > 1) {
                connectionDuplicates.push({
                    key: key,
                    entries: entries,
                    measures: entries.map(entry => Math.floor(entry.connection.beat / 4))
                });
            }
        }
    });

    let resultHTML = '<h2>結果</h2>';
    resultHTML += formatDuplicateResults(objectDuplicates, '重複しているノーツ');
    resultHTML += formatDuplicateResults(connectionDuplicates, '重複しているスライド');

    resultsDiv.innerHTML = resultHTML;
}

function formatDuplicateResults(duplicates, title) {
    if (duplicates.length === 0) {
        return `<p>${title}はありません。</p>`;
    }

    let resultHTML = `<p>${title}:</p><ul>`;
    duplicates.forEach(duplicate => {
        resultHTML += `<li>項目: ${duplicate.key}</li><ul>`;
        duplicate.entries.forEach((item, index) => {
            const measure = duplicate.measures[index];
            resultHTML += `<li>${measure}小節目 - lane: ${item.connection ? item.connection.lane : item.lane}, 幅: ${item.connection ? item.connection.size * 2 : item.size * 2}</li>`;
        });
        resultHTML += '</ul>';
    });
    resultHTML += '</ul>';
    return resultHTML;
}

function processSUSFile(content) {
    const resultsDiv = document.getElementById('results');
    const lines = content.split('\n');
    const items = new Map();
    let duplicates = [];

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#') && line.length > 6 && line[6] === ':') {
            const measure = parseInt(line.substring(1, 4));
            const type = line.substring(4, 5);
            const lane = line.substring(5, 6);
            const notes = line.substring(7).match(/.{2}/g);

            if (notes && notes.length > 0) {
                notes.forEach((note, index) => {
                    if (note !== '00') {
                        const beat = (index / notes.length) * 4;
                        const width = parseInt(note[1]); // 幅を取得
                        const key = `${measure}-${type}-${lane}-${width}-${beat}`;
                        if (items.has(key)) {
                            items.get(key).push({ measure, type, lane, width });
                        } else {
                            items.set(key, [{ measure, type, lane, width }]);
                        }
                    }
                });
            }
        }
    });

    items.forEach((value, key) => {
        if (value.length > 1) {
            duplicates.push({
                key: key,
                entries: value
            });
        }
    });

    let resultHTML = '<h2>結果</h2>';
    if (duplicates.length > 0) {
        resultHTML += '<p>重複している項目:</p><ul>';
        duplicates.forEach(duplicate => {
            resultHTML += `<li>項目: ${duplicate.key}</li><ul>`;
            duplicate.entries.forEach(item => {
                resultHTML += `<li>${item.measure}小節目 - 分類: ${item.type}, 幅: ${item.width}</li>`;
            });
            resultHTML += '</ul>';
        });
        resultHTML += '</ul>';
    } else {
        resultHTML += '<p>重複している項目はありません。</p>';
    }

    resultsDiv.innerHTML = resultHTML;
}
