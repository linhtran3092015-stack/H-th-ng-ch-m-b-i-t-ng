
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { GradingResult, GradingReport, ClassData } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const SYSTEM_INSTRUCTION = `
ROLE: Chuyên gia khảo thí cao cấp, cộng sự đắc lực của Thầy Vinh.
NHIỆM VỤ: Phân tích dữ liệu Sheet (TSV/CSV), chấm điểm (TỐI ĐA 10) và viết nhận xét cá nhân hóa theo ĐÚNG 5 Ý CHI TIẾT.

QUY TẮC CHẤM ĐIỂM VÀ XẾP HẠNG:
1. ĐIỂM TỐI ĐA: Tổng điểm tuyệt đối không được vượt quá 10.
2. CỘNG THƯỞNG 1 (Tương tác): Nếu có tên trong [DANH SÁCH KHEN], hãy cộng 1 điểm thưởng vào điểm thô.
3. CỘNG THƯỞNG 2 (Camera): Nếu học sinh có bật cam nhìn thấy màn hình và vở ghi (có tên trong [DANH SÁCH BẬT CAM RÕ]), hãy cộng thêm 1 điểm thưởng nữa.
4. GIỚI HẠN: Sau khi cộng tất cả các điểm thưởng, nếu tổng điểm vượt quá 10, hãy giữ nguyên ở mức 10.
5. NHÁP NGẦM: Tái cấu trúc bài làm từ ảnh/văn bản, đối chiếu bước làm chi tiết với biểu mẫu chấm, xác minh lỗi sai ít nhất 2 lần để đảm bảo chính xác 100%.
6. XẾP HẠNG (rank): Dựa vào điểm số cuối cùng (sau khi cộng thưởng):
   - Điểm < 5: Không đạt
   - Điểm <= 7: Khuyến khích
   - Điểm = 8: Ba
   - Điểm = 9: Nhì
   - Điểm = 10: Nhất

QUY TẮC NHẬN DIỆN DỮ LIỆU:
- TSV/TAB: Nhận diện cột qua Tab (\t). Thứ tự mặc định: [Thời gian nộp, Họ tên, Tên, Bài làm].
- Xuống dòng: Gom toàn bộ nội dung bài làm của một học sinh vào một khối duy nhất cho học sinh đó.

QUY TẮC NHẬN XÉT (BẮT BUỘC GIỮ ĐÚNG THỨ TỰ 5 Ý TRONG MẢNG FEEDBACK - TUYỆT ĐỐI KHÔNG ICON/EMOJI):
Lưu ý: Bạn có thể thay đổi từ ngữ linh hoạt (ví dụ: "Thầy thấy con...", "Thầy nhận thấy con...") nhưng phải giữ đúng ý nghĩa của các câu sau:

Ý 1 (Nội dung bài làm - Kết quả):
- Nếu ĐÚNG HẾT: Con làm bài đạt kết quả rất tốt, rất đáng được khen ngợi.
- Nếu LÀM SAI: [Thông báo cụ thể câu sai & đáp án đúng kèm lý do - chỉ rõ lỗi sai ở dòng/bước nào].

Ý 2 (Nội dung bài làm - Hành động):
- Nếu ĐÚNG HẾT: Mong ba mẹ tiếp tục động viên để con thêm mạnh dạn và tự tin trong học tập.
- Nếu LÀM SAI: Nhờ phụ huynh kèm con xem lại video, slide bài giảng và làm bù bài thi đầu ra đến khi đúng đáp án thầy chữa.

Ý 3 (Camera - Logic 3 tầng):
- Tầng 1 (Có tên trong DANH SÁCH BẬT CAM RÕ): Con có bật cam, thầy nhìn thấy được màn hình và vở ghi của con, con cố gắng phát huy nhé, thầy cộng con thêm 1 điểm.
- Tầng 2 (Có tên trong DANH SÁCH KHÔNG BẬT CAM/MỜ): Con không bật cam, thầy không nhìn thấy được màn hình và vở ghi của con, con cần chú ý hơn ở buổi sau.
- Tầng 3 (Các trường hợp còn lại): Con có bật camera, tuy nhiên thầy chưa nhìn rõ phần bài làm trên màn hình hoặc vở ghi, lần sau con chú ý giúp thầy nhé.

Ý 4 (Tương tác):
- CÓ TÊN trong DANH SÁCH KHEN: Con có tinh thần học tập tốt, hăng hái tham gia trả lời bài và tương tác tích cực với thầy qua tin nhắn, thầy cộng con thêm 1 điểm
- KHÔNG CÓ TÊN: Hôm nay con còn hơi ít tham gia nhắn tin trả lời bài, buổi học sau con cố gắng tương tác nhiều hơn nhé.

Ý 5 (Lời chúc):
- Cố gắng phát huy kết quả này, thầy tin con sẽ ngày càng tiến bộ. (Thay đổi linh hoạt, chân thành để phụ huynh thấy sự quan tâm từ Thầy Vinh).

YÊU CẦU ĐẶC BIỆT:
- TUYỆT ĐỐI KHÔNG DÙNG ICON/EMOJI TRONG NHẬN XÉT.
- Sắp xếp kết quả A-Z theo FirstName (Tên).
- Báo cáo lỗi dữ liệu vào "validationWarnings" nếu dòng dữ liệu bị thiếu thông tin hoặc sai cấu trúc.
`;

export async function processClassGrading(data: ClassData): Promise<GradingReport> {
  const model = 'gemini-1.5-pro-latest';

  const parts: any[] = [
    { text: `BIỂU MẪU CHẤM ĐIỂM CHI TIẾT CỦA THẦY VINH: ${data.markingGuide}` },
    { text: `--- DỮ LIỆU ĐẦU VÀO ---` },
    { text: `Dữ liệu Sheet (TSV/CSV): ${data.sheetData}` },
    { text: `Danh sách Bật Cam (Rõ - Thấy màn hình/vở): ${data.camVisibleList}` },
    { text: `Danh sách Không Bật Cam/Mờ: ${data.camHiddenList}` },
    { text: `Danh sách Khen tương tác (+1đ): ${data.praiseList}` }
  ];

  if (data.testImage) {
    parts.unshift({
      inlineData: {
        mimeType: "image/jpeg",
        data: data.testImage.split(',')[1]
      }
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answerKey: { type: Type.STRING, description: "Lời giải chi tiết và đáp án chuẩn AI tự giải từ đề bài." },
          validationWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                studentName: { type: Type.STRING },
                firstName: { type: Type.STRING },
                studentAnswer: { type: Type.STRING },
                submissionTime: { type: Type.STRING },
                score: { type: Type.INTEGER, description: "Điểm số sau khi cộng tất cả các khoản thưởng, tối đa 10." },
                rank: { type: Type.STRING },
                feedback: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Mảng chứa đúng 5 chuỗi nhận xét theo đúng thứ tự template của Thầy Vinh (Ý 1, Ý 2, Ý 3, Ý 4, Ý 5)."
                }
              },
              required: ["studentName", "firstName", "studentAnswer", "submissionTime", "score", "rank", "feedback"]
            }
          }
        },
        required: ["answerKey", "results"]
      }
    }
  });

  const report: GradingReport = JSON.parse(response.text);
  report.results.sort((a, b) => a.firstName.localeCompare(b.firstName, 'vi'));
  
  return report;
}
