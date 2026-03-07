// URL格式化
const formatURL = (props: any, v: any, key?: string) => {
  let FILE_ID = '';
  const ERROR_MSG = `${v._vh_filename} 上传失败`;
  
  // 判断是否为 Telegram 链接
  const isTelegram = v.data.link && v.data.link.includes('api.telegram.org');
  
  try {
    FILE_ID = v.data.link.split('/').slice(-1)[0];
  } catch { }
  
  // Telegram 使用直接链接，不需要通过代理
  if (isTelegram) {
    if (key == 'md') {
      return FILE_ID ? `![${v._vh_filename}](${v.data.link})` : ERROR_MSG;
    }
    return FILE_ID ? v.data.link : ERROR_MSG;
  }
  
  // Imgur 使用代理链接
  if (key == 'md') {
    return FILE_ID ? `![${v._vh_filename}](${props.nodeHost}/v2/${FILE_ID})` : ERROR_MSG;
  }
  return FILE_ID ? `${props.nodeHost}/v2/${FILE_ID}` : ERROR_MSG;
};

export { formatURL }
