const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");
const attendanceList = document.getElementById("attendance-list");
const saveButton = document.getElementById("save");

let labeledDescriptors;
let faceMatcher;
let presentStudents = new Set();

// 👉 Thay link này bằng link API Google Apps Script của bạn
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbweYkVoQ0Cds6rznWTmyCmHAeb0KDw_ckGiUM4c-yJGptqvrgmrCXnVNy8XNOWzkMjVEw/exec";

// Bắt đầu camera
async function startVideo() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
  video.srcObject = stream;
}

// Load model và dữ liệu khuôn mặt
async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("models/");
  await faceapi.nets.faceLandmark68Net.loadFromUri("models/");
  await faceapi.nets.faceRecognitionNet.loadFromUri("models/");
  await faceapi.nets.ssdMobilenetv1.loadFromUri("models/");
  labeledDescriptors = await loadLabeledImages();
  faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
  console.log("✅ Models loaded");
}

// Load ảnh học sinh
function loadLabeledImages() {
  const labels = ["001","002","003"]; // 👉 Thay bằng tên file trong folder faces/
  return Promise.all(
    labels.map(async label => {
      const img = await faceapi.fetchImage(`faces/${label}.jpg`);
      const detections = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      return new faceapi.LabeledFaceDescriptors(label, [detections.descriptor]);
    })
  );
}

// Chạy nhận diện
video.addEventListener("play", () => {
  overlay.width = video.width;
  overlay.height = video.height;

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const results = detections.map(d =>
      faceMatcher.findBestMatch(d.descriptor)
    );

    results.forEach((result, i) => {
      const box = detections[i].detection.box;
      const { label } = result;

      ctx.strokeStyle = "green";
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      ctx.fillStyle = "green";
      ctx.fillText(label, box.x, box.y - 5);

      if (label !== "unknown") {
        presentStudents.add(label);
        updateAttendanceList();
      }
    });
  }, 1000);
});

// Cập nhật danh sách hiển thị
function updateAttendanceList() {
  attendanceList.innerHTML = "";
  presentStudents.forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    attendanceList.appendChild(li);
  });
}

// Gửi dữ liệu lên Google Sheet
saveButton.addEventListener("click", () => {
  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ students: Array.from(presentStudents) }),
    headers: { "Content-Type": "application/json" }
  })
    .then(res => res.text())
    .then(msg => alert("✅ Đã gửi danh sách lên Google Sheet"))
    .catch(err => console.error(err));
});

// Khởi động
startVideo();
loadModels();
