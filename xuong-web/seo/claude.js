// Gọi claude CLI làm "biên tập viên SEO". Không có claude → nơi gọi tự xử lý lỗi.
import { spawn } from 'node:child_process';

function chayLenh(lenh, args, { stdinText = null, gioiHanGiay = 600 } = {}) {
  return new Promise((resolve) => {
    const moiTruong = { ...process.env };
    delete moiTruong.CLAUDECODE;
    delete moiTruong.CLAUDE_CODE_ENTRYPOINT;
    const tt = spawn(lenh, args, { env: moiTruong });
    let out = '', err = '';
    const henGio = setTimeout(() => tt.kill('SIGKILL'), gioiHanGiay * 1000);
    tt.stdout.on('data', (d) => { out += d; });
    tt.stderr.on('data', (d) => { err += d; });
    tt.on('error', (e) => { clearTimeout(henGio); resolve({ ma: -1, out, err: String(e) }); });
    tt.on('close', (ma) => { clearTimeout(henGio); resolve({ ma, out, err }); });
    if (stdinText !== null) tt.stdin.write(stdinText);
    tt.stdin.end();
  });
}

export async function goiClaude(prompt, { gioiHanGiay = 600 } = {}) {
  const args = ['-p'];
  if (process.env.WEB_MODEL) args.push('--model', process.env.WEB_MODEL);
  const kq = await chayLenh('claude', args, { stdinText: prompt, gioiHanGiay });
  if (kq.ma !== 0) {
    throw new Error(`claude CLI lỗi (mã ${kq.ma}): ${(kq.err || kq.out).slice(-400) || 'không gọi được lệnh claude'}`);
  }
  return kq.out;
}

/**
 * Đọc JSON, nếu hỏng thì vá lỗi hay gặp nhất của mô hình:
 * xuống dòng/tab thật nằm trong chuỗi (JSON chuẩn bắt buộc phải là \n, \t).
 */
function docLong(tho) {
  try { return JSON.parse(tho); } catch { /* thử vá bên dưới */ }
  let ra = '', trongChuoi = false, thoat = false;
  for (const c of tho) {
    if (thoat) { ra += c; thoat = false; continue; }
    if (c === '\\') { ra += c; thoat = true; continue; }
    if (c === '"') { trongChuoi = !trongChuoi; ra += c; continue; }
    if (trongChuoi && c === '\n') { ra += '\\n'; continue; }
    if (trongChuoi && c === '\r') { continue; }
    if (trongChuoi && c === '\t') { ra += '\\t'; continue; }
    ra += c;
  }
  try { return JSON.parse(ra); } catch { return null; }
}

/** Bóc JSON từ câu trả lời (chịu được ```json và chữ thừa quanh nó). */
export function trichJson(chuoi) {
  const s = String(chuoi);
  const khoi = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const tho = khoi ? khoi[1] : s;
  const dau = tho.search(/[[{]/);
  if (dau === -1) return null;
  const mo = tho[dau];
  const dong = mo === '{' ? '}' : ']';
  let sau = 0, trongChuoi = false, thoat = false;
  for (let i = dau; i < tho.length; i++) {
    const c = tho[i];
    if (thoat) { thoat = false; continue; }
    if (c === '\\') { thoat = true; continue; }
    if (c === '"') { trongChuoi = !trongChuoi; continue; }
    if (trongChuoi) continue;
    if (c === mo) sau++;
    else if (c === dong) { sau--; if (!sau) return docLong(tho.slice(dau, i + 1)); }
  }
  // Câu trả lời bị cắt giữa chừng: thử đọc phần còn lại như JSON hỏng.
  return docLong(tho.slice(dau));
}

/** Hỏi claude và bắt buộc nhận JSON; thử lại 1 lần khi JSON hỏng. */
export async function hoiJson(prompt, tuyChon) {
  let ra = await goiClaude(prompt, tuyChon);
  let dl = trichJson(ra);
  if (!dl) {
    ra = await goiClaude(`Câu trả lời trước không phải JSON hợp lệ. CHỈ trả về đúng một khối JSON theo mẫu đã yêu cầu, không thêm lời dẫn.\n\n${prompt}`, tuyChon);
    dl = trichJson(ra);
  }
  if (!dl) throw new Error('Không đọc được JSON từ câu trả lời của claude.');
  return dl;
}

/** Có lệnh claude trong máy không. */
export async function coClaude() {
  const kq = await chayLenh('claude', ['--version'], { gioiHanGiay: 20 });
  return kq.ma === 0;
}
