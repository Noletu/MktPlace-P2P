import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testReviewStats() {
  const nicolasId = 'cmhroskpp000013bmpuaj0cwd';

  console.log(`🔍 Testando stats para Nicolas (${nicolasId})...\n`);

  // Buscar reviews recebidas por Nicolas
  const reviews = await prisma.review.findMany({
    where: {
      reviewedId: nicolasId,
      isHidden: false,
    },
  });

  console.log(`📊 Reviews encontradas: ${reviews.length}`);

  if (reviews.length === 0) {
    console.log('❌ Nenhuma review encontrada!\n');
    return;
  }

  reviews.forEach((review, index) => {
    console.log(`\n${index + 1}. Review ID: ${review.id}`);
    console.log(`   ReviewerId: ${review.reviewerId}`);
    console.log(`   ReviewedId: ${review.reviewedId}`);
    console.log(`   Rating: ${review.rating}`);
    console.log(`   isHidden: ${review.isHidden}`);
    console.log(`   isSuspicious: ${review.isSuspicious}`);
  });

  // Calcular stats manualmente
  const totalReviews = reviews.length;
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = totalRating / totalReviews;

  const ratingDistribution = {
    5: reviews.filter((r) => r.rating === 5).length,
    4: reviews.filter((r) => r.rating === 4).length,
    3: reviews.filter((r) => r.rating === 3).length,
    2: reviews.filter((r) => r.rating === 2).length,
    1: reviews.filter((r) => r.rating === 1).length,
  };

  // Médias de categorias
  const reviewsWithReliability = reviews.filter((r) => r.reliabilityRating !== null);
  const averageReliability = reviewsWithReliability.length > 0
    ? reviewsWithReliability.reduce((sum, r) => sum + (r.reliabilityRating || 0), 0) / reviewsWithReliability.length
    : 0;

  const reviewsWithCommunication = reviews.filter((r) => r.communicationRating !== null);
  const averageCommunication = reviewsWithCommunication.length > 0
    ? reviewsWithCommunication.reduce((sum, r) => sum + (r.communicationRating || 0), 0) / reviewsWithCommunication.length
    : 0;

  const reviewsWithSpeed = reviews.filter((r) => r.speedRating !== null);
  const averageSpeed = reviewsWithSpeed.length > 0
    ? reviewsWithSpeed.reduce((sum, r) => sum + (r.speedRating || 0), 0) / reviewsWithSpeed.length
    : 0;

  console.log('\n\n📊 Stats Calculadas:');
  console.log(JSON.stringify({
    totalReviews,
    averageRating: Number(averageRating.toFixed(2)),
    ratingDistribution,
    averageReliability: Number(averageReliability.toFixed(2)),
    averageCommunication: Number(averageCommunication.toFixed(2)),
    averageSpeed: Number(averageSpeed.toFixed(2)),
  }, null, 2));

  console.log('\n✅ Teste concluído!\n');
}

testReviewStats()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
