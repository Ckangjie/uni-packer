<template>
  <div class="tab-pane w-full max-w-[1280px] mx-auto">
    <EnvStatusCard
      :env-data="envData"
      :is-loading="isLoading"
      @copy="$emit('copy', $event)"
      @refresh-env="$emit('refresh-env')"
      @navigate-guide="$emit('navigate-guide', $event)"
    />
  </div>
</template>

<script setup>
import EnvStatusCard from '@/components/EnvStatusCard.vue'

defineProps({
  envData: {
    type: Object,
    default: () => ({})
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['copy', 'refresh-env', 'navigate-guide'])
</script>
