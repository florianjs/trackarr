<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="card p-6">
      <h3 class="text-lg font-bold mb-4">Pending Reports</h3>
      <p class="text-sm text-text-muted">
        Check the reports section to handle user complaints.
      </p>
      <NuxtLink to="/mod/reports" class="btn btn-primary mt-4 inline-block"
        >View Reports</NuxtLink
      >
    </div>
    <div class="card p-6">
      <h3 class="text-lg font-bold mb-4">Recent H&R</h3>
      <p class="text-sm text-text-muted">
        Monitor users who are not seeding back.
      </p>
      <NuxtLink to="/mod/hnr" class="btn btn-primary mt-4 inline-block"
        >View H&R</NuxtLink
      >
    </div>
  </div>
</template>
