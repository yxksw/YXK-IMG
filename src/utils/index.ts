const formatURL = (props: any, v: any, key?: string) => {
  let FILE_ID = '';
  const ERROR_MSG = `${v._vh_filename} 上传失败`;

  const storageType = props.storageType || 'imgur';

  try {
    if (storageType === 'telegram') {
      FILE_ID = v[0]?.file_id || v.file_id;
      if (!FILE_ID) {
        const src = v[0]?.src || v.src;
        if (src) {
          FILE_ID = src.split('/').pop();
        }
      }
      if (FILE_ID && FILE_ID.includes('.')) {
        FILE_ID = FILE_ID.split('.')[0];
      }
    } else {
      const link = v.data?.link || v[0]?.src;
      if (link) {
        FILE_ID = link.split('/').slice(-1)[0];
      }
    }
  } catch { }

  if (storageType === 'telegram') {
    const ext = v[0]?.file_type?.split('/')[1] || v[0]?.src?.split('.').pop() || 'jpg';
    if (key == 'md') {
      return FILE_ID ? `![${v._vh_filename || v.file_name}](${props.nodeHost}/file/${FILE_ID}.${ext})` : ERROR_MSG;
    }
    return FILE_ID ? `${props.nodeHost}/file/${FILE_ID}.${ext}` : ERROR_MSG;
  } else {
    if (key == 'md') {
      return FILE_ID ? `![${v._vh_filename}](${props.nodeHost}/v2/${FILE_ID})` : ERROR_MSG;
    }
    return FILE_ID ? `${props.nodeHost}/v2/${FILE_ID}` : ERROR_MSG;
  }
};

export { formatURL }
