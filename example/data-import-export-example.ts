import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
    addDroneObjects, 
    addDroneTrails, 
    parseDroneCSV, 
    parseGeoJSON, 
    exportDroneDataToCSV, 
    exportDroneDataToGeoJSON, 
    downloadFile, 
    generateSampleDroneData, 
    clearDroneData,
    type DroneObject,
    type Point3D, 
    type MeshVertex 
} from '../src/data-import-export';

// 関数を再エクスポート（HTMLから利用するため）
export { 
    addDroneObjects, 
    addDroneTrails, 
    parseDroneCSV, 
    parseGeoJSON, 
    exportDroneDataToCSV, 
    exportDroneDataToGeoJSON, 
    downloadFile, 
    generateSampleDroneData, 
    clearDroneData,
    type DroneObject
};

// 地図の初期化
const map = new maplibregl.Map({
    container: 'app',
    zoom: 13,
    center: [139.6917, 35.6895],
    minZoom: 5,
    maxZoom: 20,
    pitch: 60,
    maxPitch: 100,
    style: {
        version: 8,
        projection: {
            type: 'globe',
        },
        sources: {
            seamlessphoto: {
                type: 'raster',
                tiles: [
                    'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
                ],
                maxzoom: 18,
                tileSize: 256,
                attribution:
                    '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
            },
        },
        layers: [
            {
                id: 'seamlessphoto',
                source: 'seamlessphoto',
                type: 'raster',
            },
        ],
    },
});

// UI要素の作成
const createUI = () => {
    const container = document.getElementById('app');
    if (!container) return;

    // UIコンテナの作成
    const uiContainer = document.createElement('div');
    uiContainer.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
        font-size: 14px;
    `;

    // タイトル
    const title = document.createElement('h3');
    title.textContent = '3Dデータ Import/Export';
    title.style.margin = '0 0 15px 0';
    uiContainer.appendChild(title);

    // ファイルアップロードセクション
    const uploadSection = document.createElement('div');
    uploadSection.style.marginBottom = '15px';

    const uploadLabel = document.createElement('label');
    uploadLabel.textContent = 'CSVファイルを選択:';
    uploadLabel.style.display = 'block';
    uploadLabel.style.marginBottom = '5px';
    uploadSection.appendChild(uploadLabel);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    fileInput.style.marginBottom = '10px';
    uploadSection.appendChild(fileInput);

    const dataTypeSelect = document.createElement('select');
    dataTypeSelect.style.marginBottom = '10px';
    dataTypeSelect.style.width = '100%';
    dataTypeSelect.innerHTML = `
        <option value="points">ポイントデータ</option>
        <option value="mesh">メッシュデータ</option>
    `;
    uploadSection.appendChild(dataTypeSelect);

    const importButton = document.createElement('button');
    importButton.textContent = 'インポート';
    importButton.style.cssText = `
        background: #007cba;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 5px;
    `;
    uploadSection.appendChild(importButton);

    const clearButton = document.createElement('button');
    clearButton.textContent = 'クリア';
    clearButton.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    uploadSection.appendChild(clearButton);

    uiContainer.appendChild(uploadSection);

    // サンプルデータセクション
    const sampleSection = document.createElement('div');
    sampleSection.style.marginBottom = '15px';

    const sampleLabel = document.createElement('label');
    sampleLabel.textContent = 'サンプルデータ:';
    sampleLabel.style.display = 'block';
    sampleLabel.style.marginBottom = '5px';
    sampleSection.appendChild(sampleLabel);

    const samplePointsButton = document.createElement('button');
    samplePointsButton.textContent = 'ポイントデータ';
    samplePointsButton.style.cssText = `
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 5px;
    `;
    sampleSection.appendChild(samplePointsButton);

    const sampleMeshButton = document.createElement('button');
    sampleMeshButton.textContent = 'メッシュデータ';
    sampleMeshButton.style.cssText = `
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    sampleSection.appendChild(sampleMeshButton);

    uiContainer.appendChild(sampleSection);

    // エクスポートセクション
    const exportSection = document.createElement('div');

    const exportLabel = document.createElement('label');
    exportLabel.textContent = 'データエクスポート:';
    exportLabel.style.display = 'block';
    exportLabel.style.marginBottom = '5px';
    exportSection.appendChild(exportLabel);

    const exportButton = document.createElement('button');
    exportButton.textContent = 'CSVエクスポート';
    exportButton.style.cssText = `
        background: #ffc107;
        color: #212529;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    exportSection.appendChild(exportButton);

    uiContainer.appendChild(exportSection);

    // コンテナにUIを追加
    container.appendChild(uiContainer);

    // イベントハンドラーの設定
    importButton.addEventListener('click', async () => {
        const file = fileInput.files?.[0];
        if (!file) {
            alert('ファイルを選択してください');
            return;
        }

        try {
            const dataType = dataTypeSelect.value as 'points' | 'mesh';
            await importDataFromFile(file, map, dataType);
            alert('データのインポートが完了しました');
        } catch (error) {
            console.error('インポートエラー:', error);
            alert('インポート中にエラーが発生しました');
        }
    });

    clearButton.addEventListener('click', () => {
        clearData(map);
        alert('データをクリアしました');
    });

    samplePointsButton.addEventListener('click', async () => {
        try {
            const response = await fetch('../data/mock-3d-data.csv');
            const csvContent = await response.text();
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'sample-points.csv', { type: 'text/csv' });
            
            await importDataFromFile(file, map, 'points');
            alert('サンプルポイントデータを読み込みました');
        } catch (error) {
            console.error('サンプルデータ読み込みエラー:', error);
            alert('サンプルデータの読み込みに失敗しました');
        }
    });

    sampleMeshButton.addEventListener('click', async () => {
        try {
            const response = await fetch('../data/mock-mesh-data.csv');
            const csvContent = await response.text();
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'sample-mesh.csv', { type: 'text/csv' });
            
            await importDataFromFile(file, map, 'mesh');
            alert('サンプルメッシュデータを読み込みました');
        } catch (error) {
            console.error('サンプルデータ読み込みエラー:', error);
            alert('サンプルデータの読み込みに失敗しました');
        }
    });

    exportButton.addEventListener('click', () => {
        // 現在のデータを取得してエクスポート
        const sources = map.getStyle().sources;
        let data: Point3D[] | MeshVertex[] = [];

        // 実際の実装では、現在表示されているデータを取得する必要があります
        // ここではサンプルデータをエクスポート
        const sampleData: Point3D[] = [
            { x: 139.6917, y: 35.6895, z: 100, elevation: 100, type: 'point', description: 'サンプルポイント' }
        ];

        const csvContent = exportDataToCSV(sampleData);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported-data.csv';
        a.click();
        
        URL.revokeObjectURL(url);
        alert('データをエクスポートしました');
    });
};

// 地図の読み込み完了後にUIを作成
map.on('load', () => {
    createUI();
}); 