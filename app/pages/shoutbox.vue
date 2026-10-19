<template>
  <Shoutbox />
</template>

<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('shoutbox.title') });
</script>
