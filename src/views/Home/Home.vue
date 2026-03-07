<template>
  <section class="Home pt-4 sm:pt-6">
    <Alert class="pt-0 pb-2 sm:py-4">
      <AlertTitle class="font-bold hidden sm:flex sm:gap-2"> <RocketIcon class="h-4 w-4 hidden sm:flex" /> Heads up!</AlertTitle>
      <AlertDescription class="p-0 text-xs sm:text-sm">
        <p class="pt-2">无限图片储存数量，你可以上传不限数量的图片！</p>
        <p>图片首次访问后缓存，"永久"有效，包括全球分布的 CDN，以确保尽可能快地提供图像.</p>
        <p>YXK 图床 是 <a class="text-slate-400" href="https://www.050815.xyz" target="_blank" title="异飨客">异飨客</a> 的图床，支持 Imgur 和 Telegram 存储。</p>
        <p style="font-weight: bold">开源地址: <a class="text-[#0969da]" href="https://github.com/yxksw/YXK-IMG" target="_blank">YXK-IMG</a></p>
      </AlertDescription>
    </Alert>

    <div class="pt-6 flex items-center text-sm">
      <div class="sync shrink-0">
        <RadioGroup v-model="storageType" class="flex items-center gap-4 [&>label]:flex [&>label]:items-center [&>label]:space-x-2 [&>label]:cursor-pointer">
          <Label for="imgur">
            <RadioGroupItem id="imgur" value="imgur" />
            <span>Imgur</span>
          </Label>
          <Label for="telegram">
            <RadioGroupItem id="telegram" value="telegram" />
            <span>Telegram</span>
          </Label>
        </RadioGroup>
      </div>
    </div>
    <Upload v-model="fileList" :UploadConfig="UploadConfig" :uploadAPI="uploadAPI" />
    <section v-show="fileList.length" class="vh-tools"><Button @click="fileList = []">清空</Button><Button @click="vh.CopyText(fileList.map((i: any) => i.upload_blob).join('\n'))">复制全部</Button></section>
    <ResList v-model="fileList" :nodeHost="imageHost" :storageType="storageType" />
  </section>
</template>
<script setup lang="ts">
import vh from 'vh-plugin';
import { ref, watch, computed } from 'vue';
import { formatURL } from '@/utils/index';
import { Button } from '@/components/ui/button';
import Upload from '@/components/Upload/Upload.vue';
import ResList from '@/components/ResList/ResList.vue';
import { RocketIcon } from '@radix-icons/vue';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const storageType = ref<string>(localStorage.getItem('storageType') || 'imgur');

const nodeHost = ref<string>(import.meta.env.VITE_IMG_API_URL || location.origin);

const imageHost = ref<string>(import.meta.env.VITE_IMG_HOST_URL || import.meta.env.VITE_IMG_API_URL || location.origin);

const uploadAPI = computed(() => {
  return `${nodeHost.value}/upload?storage=${storageType.value}`;
});

const UploadConfig = ref<any>({
  AcceptTypes: 'image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.json,.xml,.html,.css,.js,.ts,.zip,.rar,.7z,.tar,.gz',
  Max: 0,
  MaxSize: storageType.value === 'telegram' ? 20 : 15,
});

watch(storageType, (newVal) => {
  localStorage.setItem('storageType', newVal);
  UploadConfig.value.MaxSize = newVal === 'telegram' ? 20 : 15;
});

const fileList = ref<Array<any>>(JSON.parse(localStorage.getItem('zychUpImageList') || '[]'));
watch(fileList, (newVal) => {
  localStorage.setItem(
    'zychUpImageList',
    JSON.stringify(
      newVal
        .filter((i: any) => i.upload_status == 'success')
        .map((i: any) => {
          i.upload_blob = formatURL({ nodeHost: imageHost.value, storageType: storageType.value }, i.upload_result);
          return i;
        }),
    ),
  );
});
</script>

<style scoped lang="less">
@import 'Home.less';
</style>
