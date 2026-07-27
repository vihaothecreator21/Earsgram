// src/services/avatarService.ts
export const uploadAvatarToCloudinary = async (uri: string) => {
  try {
    // 1. Chuẩn bị dữ liệu form
    // Lưu ý: React Native yêu cầu object file phải có uri, type và name
    const formData = new FormData();
    formData.append("file", {
      uri: uri,
      type: "image/jpeg", // Hoặc lấy type thật từ file nếu cần
      name: "avatar.jpg",
    } as any);

    // 2. Điền thông tin Cloudinary của bạn vào đây
    const UPLOAD_PRESET = "eargasm_preset"; // Tên preset bạn vừa tạo (Unsigned)
    const CLOUD_NAME = "dwhgdtdli"; // Lấy trong Dashboard

    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("cloud_name", CLOUD_NAME);

    // 3. Gọi API upload
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    const bodyText = await response.text();
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error(bodyText.slice(0, 120) || "Invalid Cloudinary response");
    }

    if (data.error) {
      throw new Error(data.error.message);
    }

    // 4. Trả về URL ảnh (dùng secure_url để lấy https)
    return data.secure_url;
  } catch (error) {
    if (__DEV__) console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};
