// URL格式化
const formatURL = (props: any, v: any, key?: string) => {
  let FILE_ID = '';
  const ERROR_MSG = `${v._vh_filename} 上传失败`;

  // 判断存储类型
  const storageType = props.storageType || 'imgur';

  try {
    if (storageType === 'telegram') {
      // Telegram 存储格式
      FILE_ID = v[0]?.file_id || v.file_id;
      if (!FILE_ID) {
        // 尝试从 src 中提取 file_id
        const src = v[0]?.src || v.src;
        if (src) {
          FILE_ID = src.split('/').pop();
        }
      }
    } else {
      // Imgur 存储格式
      const link = v.data?.link || v[0]?.src;
      if (link) {
        FILE_ID = link.split('/').slice(-1)[0];
      }
    }
  } catch { }

  if (storageType === 'telegram') {
    // Telegram 存储的 URL 格式
    if (key == 'md') {
      return FILE_ID ? `![${v._vh_filename || v.file_name}](${props.nodeHost}/file/${FILE_ID})` : ERROR_MSG;
    }
    return FILE_ID ? `${props.nodeHost}/file/${FILE_ID}` : ERROR_MSG;
  } else {
    // Imgur 存储的 URL 格式（保持原有逻辑）
    if (key == 'md') {
      return FILE_ID ? `![${v._vh_filename}](${props.nodeHost}/v2/${FILE_ID})` : ERROR_MSG;
    }
    return FILE_ID ? `${props.nodeHost}/v2/${FILE_ID}` : ERROR_MSG;
  }
};

export { formatURL }
