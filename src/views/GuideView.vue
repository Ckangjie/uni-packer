<template>
  <div class="tab-pane w-full max-w-[1280px] mx-auto">
    <PackGuideCard ref="guideCardRef" @copy="$emit('copy', $event)" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PackGuideCard from '@/components/PackGuideCard.vue'

const guideCardRef = ref(null)

defineEmits(['copy'])

function expandJdkGuide() {
  guideCardRef.value?.expandJdkGuide()
}

defineExpose({
  expandJdkGuide
})
</script>
