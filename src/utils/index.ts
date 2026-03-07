// URL格式化
const formatURL = (props: any, v: any, key?: string) => {
  let FILE_ID = '';
  const ERROR_MSG = `${v._vh_filename} 上传失败`;

  try {
    // Imgur 返回格式
    if (v.data && v.data.link) {
      FILE_ID = v.data.link.split('/').slice(-1)[0];
    }
    // Telegram 返回格式
    else if (v.data && v.data.url) {
      // Telegram 返回的是完整 URL，直接使用
      const url = v.data.url;
      if (key === 'md') {
        return `![${v._vh_filename}](${url})`;
      }
      return url;
    }
    // 新的 Telegram 直接链接格式
    else if (v.data && v.data.direct_url) {
      const url = v.data.direct_url;
      if (key === 'md') {
        return `![${v._vh_filename}](${url})`;
      }
      return url;
    }
  } catch { }

  // Imgur 格式回退
  if (key === 'md') {
    return FILE_ID ? `![${v._vh_filename}](${props.nodeHost}/v2/${FILE_ID})` : ERROR_MSG;
  }
  return FILE_ID ? `${props.nodeHost}/v2/${FILE_ID}` : ERROR_MSG;
};

export { formatURL }
