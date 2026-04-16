import pygame
import random
import sys

# Initialize pygame
pygame.init()

# Setup the screen dimensions
WIDTH = 800
HEIGHT = 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Simple Car Game")

# Define Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
GRAY = (50, 50, 50)
ROAD_COLOR = (120, 120, 120)

# Car properties
car_width = 50
car_height = 100
car_x = WIDTH // 2 - car_width // 2
car_y = HEIGHT - car_height - 20
car_speed = 7

# Obstacle properties
obs_width = 50
obs_height = 50
obs_x = random.randint(0, WIDTH - obs_width)
obs_y = -obs_height
obs_speed = 5

clock = pygame.time.Clock()
score = 0
font = pygame.font.SysFont(None, 48)
small_font = pygame.font.SysFont(None, 36)

def draw_car(x, y):
    # Drawing a simple green car (a rectangle)
    pygame.draw.rect(screen, GREEN, (x, y, car_width, car_height))

def draw_obstacle(x, y):
    # Drawing a red enemy block
    pygame.draw.rect(screen, RED, (x, y, obs_width, obs_height))

def draw_score(current_score):
    score_surf = small_font.render(f"Score: {current_score}", True, WHITE)
    screen.blit(score_surf, (10, 10))

def show_game_over(final_score):
    # display Game Over text
    text_surf = font.render(f"GAME OVER! Score: {final_score}", True, RED)
    text_rect = text_surf.get_rect(center=(WIDTH//2, HEIGHT//2 - 20))
    screen.blit(text_surf, text_rect)
    
    restart_surf = small_font.render("Press 'R' to Restart or 'Q' to Quit", True, WHITE)
    restart_rect = restart_surf.get_rect(center=(WIDTH//2, HEIGHT//2 + 30))
    screen.blit(restart_surf, restart_rect)
    
    pygame.display.flip()

    waiting = True
    while waiting:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r:
                    return True # signals to restart
                elif event.key == pygame.K_q:
                    pygame.quit()
                    sys.exit()

running = True
game_active = True

while running:
    # Draw background (a simple road)
    screen.fill(ROAD_COLOR)

    # Event listening
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    if game_active:
        # Get key presses for moving car
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] and car_x > 0:
            car_x -= car_speed
        if keys[pygame.K_RIGHT] and car_x < WIDTH - car_width:
            car_x += car_speed
            
        # Move the obstacle down
        obs_y += obs_speed
        
        # Check if the obstacle got past the screen
        if obs_y > HEIGHT:
            obs_y = -obs_height
            obs_x = random.randint(0, WIDTH - obs_width)
            score += 1
            # Increase difficulty slowly
            obs_speed += 0.3 
            
        # Check for collisions using Pygame Rects
        car_rect = pygame.Rect(car_x, car_y, car_width, car_height)
        obs_rect = pygame.Rect(obs_x, obs_y, obs_width, obs_height)
        
        if car_rect.colliderect(obs_rect):
            game_active = False

        # Draw components
        draw_car(car_x, car_y)
        draw_obstacle(obs_x, obs_y)
        draw_score(score)
        
    else:
        # Handle game over state
        if show_game_over(score):
            # Reset values if user wants to play again
            car_x = WIDTH // 2 - car_width // 2
            obs_y = -obs_height
            obs_x = random.randint(0, WIDTH - obs_width)
            score = 0
            obs_speed = 5
            game_active = True

    # Update screen and set framerate
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
